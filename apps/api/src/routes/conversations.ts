import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { and, asc, desc, eq, inArray, lt } from "drizzle-orm";
import { z } from "zod";
import { llm, providerInfo } from "../ai/index.js";
import type { HistoryTurn } from "../ai/types.js";
import { db, schema } from "../db/client.js";
import type { Citation } from "../db/schema.js";
import { audit } from "../lib/audit.js";
import { badRequest, HttpError, notFound, tooManyRequests } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { limiters } from "../lib/rate-limit.js";
import { contentDisposition, truncate } from "../lib/text.js";
import { consumeUsage, refundUsage } from "../lib/usage.js";
import { currentUser } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { currentWorkspace } from "../middleware/workspace.js";
import { buildCitations, verificationSummary } from "../rag/citations.js";
import { exportConversationHtml, exportConversationMarkdown } from "../rag/export.js";
import { buildUserContent, locationLabel, SYSTEM_PROMPT, toContextItems } from "../rag/prompt.js";
import { hybridSearch, searchPerDocument, type RetrievedChunk } from "../rag/retrieval.js";
import type { AppEnv } from "../types.js";

const MAX_COMPARE_DOCUMENTS = 6;
const HISTORY_TURNS = 8;

const conversationParam = z.object({ workspaceId: z.uuid(), conversationId: z.uuid() });
const createSchema = z.object({
  collectionId: z.uuid(),
  mode: z.enum(["qa", "compare"]).default("qa"),
  documentIds: z.array(z.uuid()).max(50).default([]),
  title: z.string().trim().max(120).optional(),
});
const patchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  documentIds: z.array(z.uuid()).max(50).optional(),
});
const listQuery = z.object({
  collectionId: z.uuid().optional(),
  before: z.iso.datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
});
const askSchema = z.object({ message: z.string().trim().min(2, "Escribe una pregunta").max(4000) });
const exportQuery = z.object({ format: z.enum(["md", "html"]).default("md") });

async function findConversation(workspaceId: string, conversationId: string) {
  const [conversation] = await db
    .select()
    .from(schema.conversations)
    .where(and(eq(schema.conversations.id, conversationId), eq(schema.conversations.workspaceId, workspaceId)));
  if (!conversation) throw notFound("Conversación no encontrada");
  return conversation;
}

/** Valida que los documentos existan Y sean del espacio (y del expediente, si se indica). */
async function validDocumentIds(workspaceId: string, collectionId: string | null, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ id: schema.documents.id })
    .from(schema.documents)
    .where(
      and(
        eq(schema.documents.workspaceId, workspaceId),
        inArray(schema.documents.id, ids),
        collectionId ? eq(schema.documents.collectionId, collectionId) : undefined,
      ),
    );
  if (rows.length !== new Set(ids).size) throw badRequest("Algún documento no existe o no pertenece a este expediente");
  return rows.map((r) => r.id);
}

/** Documentos listos que cubre la conversación: los elegidos o, si no hay, todo el expediente. */
async function scopeDocuments(conversation: typeof schema.conversations.$inferSelect) {
  const selected = await db
    .select({ id: schema.conversationDocuments.documentId })
    .from(schema.conversationDocuments)
    .where(eq(schema.conversationDocuments.conversationId, conversation.id));
  const rows = await db
    .select({ id: schema.documents.id, title: schema.documents.title })
    .from(schema.documents)
    .where(
      and(
        eq(schema.documents.workspaceId, conversation.workspaceId),
        eq(schema.documents.status, "ready"),
        selected.length > 0
          ? inArray(
              schema.documents.id,
              selected.map((s) => s.id),
            )
          : conversation.collectionId
            ? eq(schema.documents.collectionId, conversation.collectionId)
            : undefined,
      ),
    );
  return rows;
}

async function conversationDetail(conversation: typeof schema.conversations.$inferSelect) {
  const [messages, documents] = await Promise.all([
    db
      .select({
        id: schema.messages.id,
        role: schema.messages.role,
        content: schema.messages.content,
        citations: schema.messages.citations,
        status: schema.messages.status,
        createdAt: schema.messages.createdAt,
      })
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, conversation.id))
      .orderBy(asc(schema.messages.createdAt)),
    db
      .select({ id: schema.documents.id, title: schema.documents.title, kind: schema.documents.kind, status: schema.documents.status })
      .from(schema.conversationDocuments)
      .innerJoin(schema.documents, eq(schema.documents.id, schema.conversationDocuments.documentId))
      .where(eq(schema.conversationDocuments.conversationId, conversation.id)),
  ]);
  return { conversation, messages, documents };
}

/** Texto de una página (con caché por respuesta) para verificar citas. */
function pageTextLoader() {
  const cache = new Map<string, string>();
  return async (documentId: string, page: number): Promise<string> => {
    const key = `${documentId}:${page}`;
    if (cache.has(key)) return cache.get(key)!;
    const rows = await db
      .select({ text: schema.documentPages.text })
      .from(schema.documentPages)
      .where(and(eq(schema.documentPages.documentId, documentId), inArray(schema.documentPages.pageNumber, [page - 1, page, page + 1])))
      .orderBy(asc(schema.documentPages.pageNumber));
    const text = rows.map((r) => r.text).join("\n");
    cache.set(key, text);
    return text;
  };
}

export const conversationRoutes = new Hono<AppEnv>()
  .get("/", validate("query", listQuery), async (c) => {
    const workspace = currentWorkspace(c);
    const { collectionId, before, limit } = c.req.valid("query");
    const rows = await db
      .select({
        id: schema.conversations.id,
        title: schema.conversations.title,
        mode: schema.conversations.mode,
        collectionId: schema.conversations.collectionId,
        updatedAt: schema.conversations.updatedAt,
        createdAt: schema.conversations.createdAt,
      })
      .from(schema.conversations)
      .where(
        and(
          eq(schema.conversations.workspaceId, workspace.id),
          collectionId ? eq(schema.conversations.collectionId, collectionId) : undefined,
          before ? lt(schema.conversations.updatedAt, new Date(before)) : undefined,
        ),
      )
      .orderBy(desc(schema.conversations.updatedAt))
      .limit(limit + 1);
    const items = rows.slice(0, limit);
    return c.json({ conversations: items, nextCursor: rows.length > limit ? items.at(-1)!.updatedAt.toISOString() : null });
  })

  .post("/", validate("json", createSchema), async (c) => {
    const user = currentUser(c);
    const workspace = currentWorkspace(c);
    const body = c.req.valid("json");
    const [collection] = await db
      .select({ id: schema.collections.id })
      .from(schema.collections)
      .where(and(eq(schema.collections.id, body.collectionId), eq(schema.collections.workspaceId, workspace.id)));
    if (!collection) throw notFound("Expediente no encontrado");
    const documentIds = await validDocumentIds(workspace.id, body.collectionId, body.documentIds);
    if (body.mode === "compare" && (documentIds.length < 2 || documentIds.length > MAX_COMPARE_DOCUMENTS)) {
      throw badRequest(`Para comparar elige entre 2 y ${MAX_COMPARE_DOCUMENTS} documentos`);
    }

    const conversation = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(schema.conversations)
        .values({
          workspaceId: workspace.id,
          collectionId: body.collectionId,
          userId: user.id,
          mode: body.mode,
          title: body.title || (body.mode === "compare" ? "Comparación de documentos" : "Nueva consulta"),
        })
        .returning();
      if (documentIds.length) await tx.insert(schema.conversationDocuments).values(documentIds.map((documentId) => ({ conversationId: row!.id, documentId })));
      return row!;
    });
    await audit(c, workspace.id, "conversation.created", { type: "conversation", id: conversation.id }, { mode: body.mode });
    return c.json(await conversationDetail(conversation), 201);
  })

  .get("/:conversationId", validate("param", conversationParam), async (c) => {
    const workspace = currentWorkspace(c);
    const conversation = await findConversation(workspace.id, c.req.valid("param").conversationId);
    return c.json(await conversationDetail(conversation));
  })

  .patch("/:conversationId", validate("param", conversationParam), validate("json", patchSchema), async (c) => {
    const workspace = currentWorkspace(c);
    const conversation = await findConversation(workspace.id, c.req.valid("param").conversationId);
    const body = c.req.valid("json");
    if (body.documentIds) {
      const ids = await validDocumentIds(workspace.id, conversation.collectionId, body.documentIds);
      if (conversation.mode === "compare" && (ids.length < 2 || ids.length > MAX_COMPARE_DOCUMENTS)) {
        throw badRequest(`Para comparar elige entre 2 y ${MAX_COMPARE_DOCUMENTS} documentos`);
      }
      await db.transaction(async (tx) => {
        await tx.delete(schema.conversationDocuments).where(eq(schema.conversationDocuments.conversationId, conversation.id));
        if (ids.length) await tx.insert(schema.conversationDocuments).values(ids.map((documentId) => ({ conversationId: conversation.id, documentId })));
      });
    }
    const [updated] = await db
      .update(schema.conversations)
      .set({ ...(body.title ? { title: body.title } : {}), updatedAt: new Date() })
      .where(eq(schema.conversations.id, conversation.id))
      .returning();
    return c.json(await conversationDetail(updated!));
  })

  .delete("/:conversationId", validate("param", conversationParam), async (c) => {
    const workspace = currentWorkspace(c);
    const conversation = await findConversation(workspace.id, c.req.valid("param").conversationId);
    await db.delete(schema.conversations).where(eq(schema.conversations.id, conversation.id));
    await audit(c, workspace.id, "conversation.deleted", { type: "conversation", id: conversation.id });
    return c.json({ ok: true });
  })

  /**
   * Pregunta con respuesta en streaming (SSE sobre POST: el cliente usa fetch
   * con la cookie de sesión, no EventSource). Eventos: `sources` (fragmentos
   * recuperados), `delta` (texto), `done` (mensaje guardado con citas
   * verificadas) y `error`.
   */
  .post("/:conversationId/messages", validate("param", conversationParam), validate("json", askSchema), async (c) => {
    const user = currentUser(c);
    const workspace = currentWorkspace(c);
    const conversation = await findConversation(workspace.id, c.req.valid("param").conversationId);
    const { message } = c.req.valid("json");
    if (!limiters.ask.consume(user.id)) throw tooManyRequests("Vas muy rápido: espera unos segundos entre preguntas");

    const docs = await scopeDocuments(conversation);
    if (docs.length === 0) throw badRequest("No hay documentos listos en el alcance de esta conversación. Sube uno o espera a que termine de indexarse.", "NO_DOCUMENTS");

    await consumeUsage(workspace.id, workspace.plan, "questions");
    let chunks: RetrievedChunk[];
    let history: HistoryTurn[];
    try {
      const ids = docs.map((d) => d.id);
      chunks =
        conversation.mode === "compare"
          ? await searchPerDocument({ workspaceId: workspace.id, documentIds: ids.slice(0, MAX_COMPARE_DOCUMENTS), query: message, perDocument: 3 })
          : await hybridSearch({ workspaceId: workspace.id, documentIds: ids, query: message });
      const previous = await db
        .select({ role: schema.messages.role, content: schema.messages.content })
        .from(schema.messages)
        .where(and(eq(schema.messages.conversationId, conversation.id), eq(schema.messages.status, "complete")))
        .orderBy(desc(schema.messages.createdAt))
        .limit(HISTORY_TURNS);
      history = previous.reverse().map((m) => ({ role: m.role, content: m.content }));
      // El historial debe empezar por "user" y alternar (lo exigen algunos proveedores).
      while (history[0]?.role === "assistant") history.shift();
    } catch (error) {
      await refundUsage(workspace.id, "questions");
      throw error;
    }

    const [userMessage] = await db
      .insert(schema.messages)
      .values({ conversationId: conversation.id, userId: user.id, role: "user", content: message })
      .returning();
    const isFirst = history.length === 0;
    const context = toContextItems(chunks);
    const controller = new AbortController();

    return streamSSE(c, async (stream) => {
      stream.onAbort(() => controller.abort());
      await stream.writeSSE({
        event: "sources",
        data: JSON.stringify({
          userMessageId: userMessage!.id,
          sources: chunks.map((chunk, i) => ({
            n: i + 1,
            documentId: chunk.documentId,
            documentTitle: chunk.documentTitle,
            page: chunk.page,
            location: locationLabel(chunk.documentKind, chunk.page, chunk.heading),
          })),
        }),
      });

      let answer = "";
      let usage = { inputTokens: 0, outputTokens: 0 };
      let model: string = llm.model;
      let status: "complete" | "aborted" | "error" = "complete";
      try {
        for await (const event of llm.stream({
          system: SYSTEM_PROMPT,
          history,
          userContent: buildUserContent(message, context, conversation.mode),
          question: message,
          context,
          task: conversation.mode === "compare" ? "compare" : "answer",
          signal: controller.signal,
        })) {
          if (event.type === "text") {
            answer += event.text;
            await stream.writeSSE({ event: "delta", data: JSON.stringify({ text: event.text }) });
          } else {
            usage = event.usage;
            model = event.model;
          }
        }
        if (controller.signal.aborted) status = "aborted";
      } catch (error) {
        status = controller.signal.aborted ? "aborted" : "error";
        if (status === "error") {
          logger.error({ err: error, conversationId: conversation.id }, "falló la generación");
          const text = error instanceof HttpError ? error.message : "No se pudo generar la respuesta. Inténtalo de nuevo.";
          if (!answer) await refundUsage(workspace.id, "questions");
          await stream.writeSSE({ event: "error", data: JSON.stringify({ message: text }) }).catch(() => undefined);
        }
      }

      if (!answer.trim()) {
        if (status === "complete") answer = "No se obtuvo respuesta del modelo.";
        else return;
      }
      const citations: Citation[] = await buildCitations(answer, chunks, pageTextLoader());
      const [saved] = await db
        .insert(schema.messages)
        .values({ conversationId: conversation.id, role: "assistant", content: answer, citations, status, usage: { ...usage, model } })
        .returning();
      await db
        .update(schema.conversations)
        .set({
          updatedAt: new Date(),
          ...(isFirst && (conversation.title === "Nueva consulta" || conversation.title === "Comparación de documentos")
            ? { title: truncate(message.replace(/\s+/g, " "), 70) }
            : {}),
        })
        .where(eq(schema.conversations.id, conversation.id));
      if (!stream.aborted) {
        await stream.writeSSE({
          event: "done",
          data: JSON.stringify({
            message: { id: saved!.id, role: "assistant", content: answer, citations, status, createdAt: saved!.createdAt },
            verification: verificationSummary(citations),
          }),
        });
      }
    });
  })

  /** Exporta la conversación con sus fuentes (Markdown o HTML imprimible → PDF desde el navegador). */
  .get("/:conversationId/export", validate("param", conversationParam), validate("query", exportQuery), async (c) => {
    const workspace = currentWorkspace(c);
    const conversation = await findConversation(workspace.id, c.req.valid("param").conversationId);
    const { format } = c.req.valid("query");
    const detail = await conversationDetail(conversation);
    const meta = { workspaceName: workspace.name, exportedBy: currentUser(c).name, model: providerInfo().llm.model };
    await audit(c, workspace.id, "conversation.exported", { type: "conversation", id: conversation.id }, { format });
    const base = `folio-${conversation.title}`.slice(0, 80);
    if (format === "html") {
      return c.body(exportConversationHtml(detail, meta), 200, {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": contentDisposition(`${base}.html`),
        "Cache-Control": "private, no-store",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
      });
    }
    return c.body(exportConversationMarkdown(detail, meta), 200, {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": contentDisposition(`${base}.md`),
      "Cache-Control": "private, no-store",
    });
  });
