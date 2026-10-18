import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { and, asc, count, desc, eq, gte, ilike, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { env } from "../config/env.js";
import { PLANS } from "../config/plans.js";
import { db, schema } from "../db/client.js";
import { audit } from "../lib/audit.js";
import { sha256 } from "../lib/crypto.js";
import { badRequest, conflict, notFound, payloadTooLarge, planLimit, tooManyRequests } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { limiters } from "../lib/rate-limit.js";
import { storage } from "../lib/storage.js";
import { contentDisposition, titleFromFileName } from "../lib/text.js";
import { currentUser } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { currentWorkspace, requireRole } from "../middleware/workspace.js";
import { detectKind, MIME_BY_KIND } from "../rag/extract.js";
import { enqueueDocument } from "../rag/ingest.js";
import type { AppEnv } from "../types.js";

const collectionKind = z.enum(["legal", "compliance", "research", "general"]);
const collectionBody = z.object({
  name: z.string().trim().min(1, "Escribe un nombre").max(120),
  description: z.string().trim().max(600).default(""),
  kind: collectionKind.default("general"),
});
// Sin .default(): en zod 4 un default dentro de .partial() se aplicaría y el PATCH
// parcial resetearía campos que no se enviaron.
const collectionPatch = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(600).optional(),
  kind: collectionKind.optional(),
});
const collectionParam = z.object({ workspaceId: z.uuid(), collectionId: z.uuid() });
const documentParam = z.object({ workspaceId: z.uuid(), documentId: z.uuid() });

const listQuery = z.object({
  collectionId: z.uuid().optional(),
  status: z.enum(["queued", "processing", "ready", "failed"]).optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

const metadataSchema = z
  .object({
    authors: z.string().trim().max(400),
    year: z.string().trim().max(10),
    doi: z.string().trim().max(200),
    reference: z.string().trim().max(400),
    parties: z.string().trim().max(400),
    signedAt: z.string().trim().max(40),
    notes: z.string().trim().max(2000),
  })
  .partial();

const documentPatch = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  collectionId: z.uuid().optional(),
  metadata: metadataSchema.optional(),
});

const pagesQuery = z.object({
  from: z.coerce.number().int().min(1).default(1),
  to: z.coerce.number().int().min(1).optional(),
});

const MAX_PAGES_PER_REQUEST = 20;

async function findCollection(workspaceId: string, collectionId: string) {
  const [collection] = await db
    .select()
    .from(schema.collections)
    .where(and(eq(schema.collections.id, collectionId), eq(schema.collections.workspaceId, workspaceId)));
  if (!collection) throw notFound("Expediente no encontrado");
  return collection;
}

/** Documento del espacio (nunca de otro: el filtro por workspace es obligatorio). */
async function findDocument(workspaceId: string, documentId: string) {
  const [doc] = await db
    .select()
    .from(schema.documents)
    .where(and(eq(schema.documents.id, documentId), eq(schema.documents.workspaceId, workspaceId)));
  if (!doc) throw notFound("Documento no encontrado");
  return doc;
}

const documentView = (doc: typeof schema.documents.$inferSelect) => ({
  id: doc.id,
  collectionId: doc.collectionId,
  title: doc.title,
  originalName: doc.originalName,
  kind: doc.kind,
  sizeBytes: doc.sizeBytes,
  status: doc.status,
  error: doc.error,
  pageCount: doc.pageCount,
  chunkCount: doc.chunkCount,
  metadata: doc.metadata,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export const collectionRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const workspace = currentWorkspace(c);
    const rows = await db
      .select({
        id: schema.collections.id,
        name: schema.collections.name,
        description: schema.collections.description,
        kind: schema.collections.kind,
        createdAt: schema.collections.createdAt,
        documentCount: sql<number>`(SELECT count(*)::int FROM documents d WHERE d.collection_id = ${schema.collections.id})`,
      })
      .from(schema.collections)
      .where(eq(schema.collections.workspaceId, workspace.id))
      .orderBy(asc(schema.collections.name));
    return c.json({ collections: rows });
  })

  .post("/", requireRole("editor"), validate("json", collectionBody), async (c) => {
    const workspace = currentWorkspace(c);
    const body = c.req.valid("json");
    const [collection] = await db
      .insert(schema.collections)
      .values({ ...body, workspaceId: workspace.id, createdById: currentUser(c).id })
      .returning();
    await audit(c, workspace.id, "collection.created", { type: "collection", id: collection!.id }, { name: body.name });
    return c.json({ collection }, 201);
  })

  .patch("/:collectionId", requireRole("editor"), validate("param", collectionParam), validate("json", collectionPatch), async (c) => {
    const workspace = currentWorkspace(c);
    const { collectionId } = c.req.valid("param");
    await findCollection(workspace.id, collectionId);
    // PATCH parcial: solo se escriben los campos enviados.
    const body = Object.fromEntries(Object.entries(c.req.valid("json")).filter(([, v]) => v !== undefined));
    if (Object.keys(body).length === 0) throw badRequest("Nada que actualizar");
    const [collection] = await db
      .update(schema.collections)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(schema.collections.id, collectionId))
      .returning();
    await audit(c, workspace.id, "collection.updated", { type: "collection", id: collectionId }, body);
    return c.json({ collection });
  })

  .delete("/:collectionId", requireRole("editor"), validate("param", collectionParam), async (c) => {
    const workspace = currentWorkspace(c);
    const { collectionId } = c.req.valid("param");
    const collection = await findCollection(workspace.id, collectionId);
    const [total] = await db.select({ n: count() }).from(schema.collections).where(eq(schema.collections.workspaceId, workspace.id));
    if ((total?.n ?? 0) <= 1) throw badRequest("El espacio necesita al menos un expediente");
    const docs = await db.select({ storageKey: schema.documents.storageKey }).from(schema.documents).where(eq(schema.documents.collectionId, collectionId));
    await db.delete(schema.collections).where(eq(schema.collections.id, collectionId));
    for (const doc of docs) await storage.remove(doc.storageKey).catch((err) => logger.warn({ err }, "no se pudo borrar un archivo"));
    await audit(c, workspace.id, "collection.deleted", { type: "collection", id: collectionId }, { name: collection.name, documents: docs.length });
    return c.json({ ok: true });
  });

export const documentRoutes = new Hono<AppEnv>()
  .get("/", validate("query", listQuery), async (c) => {
    const workspace = currentWorkspace(c);
    const query = c.req.valid("query");
    const where = and(
      eq(schema.documents.workspaceId, workspace.id),
      query.collectionId ? eq(schema.documents.collectionId, query.collectionId) : undefined,
      query.status ? eq(schema.documents.status, query.status) : undefined,
      query.q ? ilike(schema.documents.title, `%${query.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`) : undefined,
    );
    const [rows, [total]] = await Promise.all([
      db
        .select()
        .from(schema.documents)
        .where(where)
        .orderBy(desc(schema.documents.createdAt))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      db.select({ n: count() }).from(schema.documents).where(where),
    ]);
    return c.json({ documents: rows.map(documentView), total: total?.n ?? 0, page: query.page, pageSize: query.pageSize });
  })

  .post(
    "/",
    requireRole("editor"),
    bodyLimit({
      maxSize: env.MAX_UPLOAD_MB * 1024 * 1024 + 64 * 1024,
      onError: () => {
        throw payloadTooLarge(`El archivo supera el máximo de ${env.MAX_UPLOAD_MB} MB`);
      },
    }),
    async (c) => {
      const user = currentUser(c);
      const workspace = currentWorkspace(c);
      if (!limiters.uploads.consume(user.id)) throw tooManyRequests("Demasiadas subidas en poco tiempo");

      const form = await c.req.formData().catch(() => {
        throw badRequest("Envía el archivo como multipart/form-data");
      });
      const file = form.get("file");
      const collectionId = String(form.get("collectionId") ?? "");
      const titleInput = String(form.get("title") ?? "").trim().slice(0, 200);
      if (!(file instanceof File)) throw badRequest("Falta el archivo");
      if (!z.uuid().safeParse(collectionId).success) throw badRequest("Elige un expediente");
      await findCollection(workspace.id, collectionId);
      if (file.size > env.MAX_UPLOAD_MB * 1024 * 1024) throw payloadTooLarge(`El archivo supera el máximo de ${env.MAX_UPLOAD_MB} MB`);

      const buffer = Buffer.from(await file.arrayBuffer());
      const originalName = (file.name || "documento").slice(0, 200);
      const kind = detectKind(buffer, originalName);
      const hash = sha256(buffer);

      const [duplicate] = await db
        .select({ id: schema.documents.id, title: schema.documents.title })
        .from(schema.documents)
        .where(and(eq(schema.documents.collectionId, collectionId), eq(schema.documents.sha256, hash)));
      if (duplicate) throw conflict(`Este archivo ya está en el expediente como «${duplicate.title}»`, "DUPLICATE_DOCUMENT");

      const extension = { pdf: "pdf", docx: "docx", markdown: "md", text: "txt" }[kind];
      const doc = await db.transaction(async (tx) => {
        // Cupo de documentos del plan, con la fila del espacio bloqueada (sin carreras).
        await tx.execute(sql`SELECT id FROM workspaces WHERE id = ${workspace.id} FOR UPDATE`);
        const [docs] = await tx.select({ n: count() }).from(schema.documents).where(eq(schema.documents.workspaceId, workspace.id));
        const max = PLANS[workspace.plan].limits.documents;
        if ((docs?.n ?? 0) >= max) throw planLimit(`Tu plan permite hasta ${max} documentos. Borra alguno o mejora el plan.`);
        const id = crypto.randomUUID();
        const storageKey = `workspaces/${workspace.id}/${id}.${extension}`;
        const [row] = await tx
          .insert(schema.documents)
          .values({
            id,
            workspaceId: workspace.id,
            collectionId,
            title: titleInput || titleFromFileName(originalName),
            originalName,
            mimeType: MIME_BY_KIND[kind],
            kind,
            sizeBytes: buffer.length,
            sha256: hash,
            storageKey,
            status: "queued",
            uploadedById: user.id,
          })
          .returning();
        // Si falla la escritura del archivo, la transacción revierte la fila.
        await storage.put(storageKey, buffer, MIME_BY_KIND[kind]);
        return row!;
      });

      enqueueDocument(doc.id);
      await audit(c, workspace.id, "document.uploaded", { type: "document", id: doc.id }, { title: doc.title, kind, sizeBytes: doc.sizeBytes });
      return c.json({ document: documentView(doc) }, 202);
    },
  )

  .get("/:documentId", validate("param", documentParam), async (c) => {
    const workspace = currentWorkspace(c);
    const doc = await findDocument(workspace.id, c.req.valid("param").documentId);
    const [collection] = await db.select({ name: schema.collections.name }).from(schema.collections).where(eq(schema.collections.id, doc.collectionId));
    return c.json({ document: { ...documentView(doc), collectionName: collection?.name ?? null } });
  })

  .patch("/:documentId", requireRole("editor"), validate("param", documentParam), validate("json", documentPatch), async (c) => {
    const workspace = currentWorkspace(c);
    const doc = await findDocument(workspace.id, c.req.valid("param").documentId);
    const body = c.req.valid("json");
    // Mover de expediente: el destino debe ser del MISMO espacio.
    if (body.collectionId && body.collectionId !== doc.collectionId) {
      await findCollection(workspace.id, body.collectionId);
      const [dup] = await db
        .select({ id: schema.documents.id })
        .from(schema.documents)
        .where(and(eq(schema.documents.collectionId, body.collectionId), eq(schema.documents.sha256, doc.sha256)));
      if (dup) throw conflict("El expediente de destino ya tiene este mismo archivo");
    }
    const [updated] = await db
      .update(schema.documents)
      .set({
        ...(body.title ? { title: body.title } : {}),
        ...(body.collectionId ? { collectionId: body.collectionId } : {}),
        // Los metadatos se fusionan: enviar solo "doi" no borra "authors".
        ...(body.metadata ? { metadata: { ...doc.metadata, ...body.metadata } } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.documents.id, doc.id))
      .returning();
    await audit(c, workspace.id, "document.updated", { type: "document", id: doc.id }, { fields: Object.keys(body) });
    return c.json({ document: documentView(updated!) });
  })

  .delete("/:documentId", requireRole("editor"), validate("param", documentParam), async (c) => {
    const workspace = currentWorkspace(c);
    const doc = await findDocument(workspace.id, c.req.valid("param").documentId);
    await db.delete(schema.documents).where(eq(schema.documents.id, doc.id));
    await storage.remove(doc.storageKey).catch((err) => logger.warn({ err, documentId: doc.id }, "no se pudo borrar el archivo"));
    await audit(c, workspace.id, "document.deleted", { type: "document", id: doc.id }, { title: doc.title });
    return c.json({ ok: true });
  })

  .post("/:documentId/reindex", requireRole("editor"), validate("param", documentParam), async (c) => {
    const workspace = currentWorkspace(c);
    const doc = await findDocument(workspace.id, c.req.valid("param").documentId);
    if (doc.status === "queued" || doc.status === "processing") throw conflict("El documento ya se está procesando");
    await db.update(schema.documents).set({ status: "queued", error: null, updatedAt: new Date() }).where(eq(schema.documents.id, doc.id));
    enqueueDocument(doc.id);
    await audit(c, workspace.id, "document.reindexed", { type: "document", id: doc.id });
    return c.json({ ok: true }, 202);
  })

  /** Texto por página para el visor (máx. 20 páginas por petición). */
  .get("/:documentId/pages", validate("param", documentParam), validate("query", pagesQuery), async (c) => {
    const workspace = currentWorkspace(c);
    const doc = await findDocument(workspace.id, c.req.valid("param").documentId);
    const { from } = c.req.valid("query");
    const to = Math.min(c.req.valid("query").to ?? from + MAX_PAGES_PER_REQUEST - 1, from + MAX_PAGES_PER_REQUEST - 1);
    const pages = await db
      .select({ number: schema.documentPages.pageNumber, heading: schema.documentPages.heading, text: schema.documentPages.text })
      .from(schema.documentPages)
      .where(and(eq(schema.documentPages.documentId, doc.id), gte(schema.documentPages.pageNumber, from), lte(schema.documentPages.pageNumber, to)))
      .orderBy(asc(schema.documentPages.pageNumber));
    return c.json({ pages, pageCount: doc.pageCount, kind: doc.kind });
  })

  /** Descarga del original (privado: solo miembros, nunca una URL pública). */
  .get("/:documentId/file", validate("param", documentParam), async (c) => {
    const workspace = currentWorkspace(c);
    const doc = await findDocument(workspace.id, c.req.valid("param").documentId);
    const data = await storage.get(doc.storageKey).catch(() => {
      throw notFound("El archivo original no está disponible");
    });
    await audit(c, workspace.id, "document.downloaded", { type: "document", id: doc.id });
    return c.body(new Uint8Array(data), 200, {
      "Content-Type": doc.mimeType,
      "Content-Disposition": contentDisposition(doc.originalName),
      "Content-Length": String(data.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
  });
