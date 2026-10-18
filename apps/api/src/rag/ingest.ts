import { and, eq, inArray } from "drizzle-orm";
import { embeddings } from "../ai/index.js";
import { env } from "../config/env.js";
import { effectivePlan } from "../config/plans.js";
import { db, schema } from "../db/client.js";
import { HttpError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { storage } from "../lib/storage.js";
import { consumeUsage, refundUsage } from "../lib/usage.js";
import { chunkPages } from "./chunker.js";
import { extractPages, type DocumentKind } from "./extract.js";

const INSERT_BATCH = 200;

/**
 * Indexa un documento: texto por página → fragmentos → embeddings → base.
 * La reclamación (`queued` → `processing`) es atómica: aunque el documento se
 * encole dos veces, solo un trabajador lo procesa.
 */
export async function processDocument(documentId: string): Promise<void> {
  const [doc] = await db
    .update(schema.documents)
    .set({ status: "processing", error: null, updatedAt: new Date() })
    .where(and(eq(schema.documents.id, documentId), eq(schema.documents.status, "queued")))
    .returning();
  if (!doc) return;

  let pagesCharged = 0;
  try {
    const [workspace] = await db.select().from(schema.workspaces).where(eq(schema.workspaces.id, doc.workspaceId));
    if (!workspace) throw new Error("Espacio de trabajo inexistente");
    const plan = effectivePlan(workspace.plan, workspace.planExpiresAt);

    const buffer = await storage.get(doc.storageKey);
    const pages = await extractPages(buffer, doc.kind as DocumentKind, env.MAX_PAGES_PER_DOCUMENT);

    // Cupo de páginas del mes (atómico). Se cobra antes de gastar en embeddings.
    await consumeUsage(doc.workspaceId, plan, "pages", pages.length);
    pagesCharged = pages.length;

    const chunks = chunkPages(pages, { maxChars: env.CHUNK_CHARS, overlapChars: env.CHUNK_OVERLAP_CHARS });
    if (chunks.length === 0) throw new HttpError(422, "El documento no contiene texto indexable", "EMPTY_DOCUMENT");

    // El encabezado de la sección y el título ayudan a la búsqueda semántica.
    const vectors = await embeddings.embed(
      chunks.map((chunk) => `${doc.title}${chunk.heading ? ` — ${chunk.heading}` : ""}\n${chunk.content}`),
    );

    await db.transaction(async (tx) => {
      // Reindexar = reemplazar todo lo anterior del documento.
      await tx.delete(schema.chunks).where(eq(schema.chunks.documentId, doc.id));
      await tx.delete(schema.documentPages).where(eq(schema.documentPages.documentId, doc.id));
      for (let i = 0; i < pages.length; i += INSERT_BATCH) {
        await tx.insert(schema.documentPages).values(
          pages.slice(i, i + INSERT_BATCH).map((page) => ({ documentId: doc.id, pageNumber: page.number, heading: page.heading, text: page.text })),
        );
      }
      for (let i = 0; i < chunks.length; i += INSERT_BATCH) {
        await tx.insert(schema.chunks).values(
          chunks.slice(i, i + INSERT_BATCH).map((chunk, j) => ({
            documentId: doc.id,
            workspaceId: doc.workspaceId,
            page: chunk.page,
            heading: chunk.heading,
            charStart: chunk.charStart,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            tokenCount: chunk.tokenCount,
            embedding: vectors[i + j]!,
          })),
        );
      }
      await tx
        .update(schema.documents)
        .set({
          status: "ready",
          error: null,
          pageCount: pages.length,
          chunkCount: chunks.length,
          embeddingModel: `${embeddings.provider}:${embeddings.model}`,
          updatedAt: new Date(),
        })
        .where(eq(schema.documents.id, doc.id));
    });
    logger.info({ documentId: doc.id, pages: pages.length, chunks: chunks.length }, "documento indexado");
  } catch (error) {
    if (pagesCharged > 0) await refundUsage(doc.workspaceId, "pages", pagesCharged).catch(() => undefined);
    const message = error instanceof HttpError ? error.message : "No se pudo procesar el documento";
    if (!(error instanceof HttpError)) logger.error({ err: error, documentId: doc.id }, "fallo al indexar");
    await db
      .update(schema.documents)
      .set({ status: "failed", error: message, updatedAt: new Date() })
      .where(eq(schema.documents.id, doc.id));
  }
}

// --- Cola en proceso ----------------------------------------------------------------

const pending: string[] = [];
const queued = new Set<string>();
let running = 0;

function pump(): void {
  while (running < env.INGEST_CONCURRENCY && pending.length > 0) {
    const id = pending.shift()!;
    running++;
    processDocument(id)
      .catch((error) => logger.error({ err: error, documentId: id }, "error inesperado en la cola"))
      .finally(() => {
        running--;
        queued.delete(id);
        pump();
      });
  }
}

/** Encola un documento para indexarlo en segundo plano. */
export function enqueueDocument(documentId: string): void {
  if (!env.WORKERS_ENABLED || queued.has(documentId)) return;
  queued.add(documentId);
  pending.push(documentId);
  pump();
}

/**
 * Al arrancar: lo que quedó `processing` por un reinicio vuelve a `queued` y
 * se reencola todo lo pendiente.
 */
export async function resumePendingDocuments(): Promise<void> {
  if (!env.WORKERS_ENABLED) return;
  await db.update(schema.documents).set({ status: "queued" }).where(eq(schema.documents.status, "processing"));
  const rows = await db
    .select({ id: schema.documents.id })
    .from(schema.documents)
    .where(inArray(schema.documents.status, ["queued"]));
  for (const row of rows) enqueueDocument(row.id);
  if (rows.length) logger.info({ count: rows.length }, "documentos pendientes reencolados");
}
