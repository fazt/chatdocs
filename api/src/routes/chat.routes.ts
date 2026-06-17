import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { db, schema } from "../db/index.js";
import { requireAuth, type AuthEnv } from "../middleware/auth.middleware.js";
import { uuid, now, first } from "../lib/utils.js";
import { embedText } from "../lib/embeddings.js";
import { topK } from "../lib/vector.js";
import { buildSystemPrompt, streamChatCompletion, buildSources } from "../lib/chat.js";
import { TOP_K_CHUNKS } from "../lib/constants.js";
import { eq, and, inArray } from "drizzle-orm";
import { validate } from "../middleware/validate.js";
import { conversationIdParamSchema, chatMessageSchema } from "../schemas/chat.schema.js";

const routes = new Hono<AuthEnv>();

routes.use("*", requireAuth);

routes.post(
  "/:conversationId",
  validate(conversationIdParamSchema, "param"),
  validate(chatMessageSchema),
  async (c) => {
    const user = c.get("user")!;
    const { conversationId } = c.req.valid("param");
    const { message } = c.req.valid("json");

    try {
      const conversation = first(
        await db
          .select()
          .from(schema.conversations)
          .where(eq(schema.conversations.id, conversationId))
      );

      if (!conversation) {
        return c.json({ error: "Conversation not found" }, 404);
      }
      if (conversation.userId !== user.userId) {
        return c.json({ error: "Forbidden" }, 403);
      }

      const linked = await db
        .select()
        .from(schema.conversationDocuments)
        .where(eq(schema.conversationDocuments.conversationId, conversationId));

      if (linked.length === 0) {
        return c.json(
          {
            error:
              "No documents linked to this conversation. Please upload a document first and link it to the conversation.",
          },
          400
        );
      }

      const documentIds = linked.map((l) => l.documentId);

      const docs = await db
        .select()
        .from(schema.documents)
        .where(
          and(
            inArray(schema.documents.id, documentIds),
            eq(schema.documents.userId, user.userId)
          )
        );

      const docMap = new Map(docs.map((d) => [d.id, d.filename]));
      const imageDocs = docs.filter((d) => d.type === "image" && d.url);

      const allChunks = await db
        .select()
        .from(schema.chunks)
        .where(inArray(schema.chunks.documentId, documentIds));

      if (allChunks.length === 0) {
        return c.json({ error: "No chunks found for the linked documents" }, 400);
      }

      const queryEmbedding = await embedText(message);
      const topChunks = topK(queryEmbedding, allChunks, TOP_K_CHUNKS);

      const history = await db
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.conversationId, conversationId))
        .orderBy(schema.messages.createdAt)
        .limit(10);

      const historyMessages = history.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      }));

      const contextChunks = topChunks.map((c) => ({
        content: c.content,
        heading: c.heading,
        documentName: docMap.get(c.documentId) || "Unknown",
      }));

      const systemPrompt = buildSystemPrompt(contextChunks);
      const sources = buildSources(
        topChunks.map((c) => ({
          id: c.id,
          heading: c.heading,
          documentName: docMap.get(c.documentId) || "Unknown",
          score: c.score,
        }))
      );

      const userMsgId = uuid();
      const timestamp = now();
      await db.insert(schema.messages).values({
        id: userMsgId,
        conversationId,
        role: "user",
        content: message,
        createdAt: timestamp,
      });

      return streamSSE(c, async (stream) => {
        try {
          let fullContent = "";
          const assMsgId = uuid();

          let userMsgContent: string | any[];
          if (imageDocs.length > 0) {
            userMsgContent = [
              { type: "text", text: message },
              ...imageDocs.map((img) => ({
                type: "image_url" as const,
                image_url: { url: img.url!, detail: "high" as const },
              })),
            ];
          } else {
            userMsgContent = message;
          }

          const gen = streamChatCompletion(systemPrompt, [
            ...historyMessages,
            { role: "user" as const, content: userMsgContent },
          ]);

          for await (const delta of gen) {
            fullContent += delta;
            await stream.writeSSE({
              event: "message",
              data: JSON.stringify({ type: "delta", content: delta }),
            });
          }

          await db.insert(schema.messages).values({
            id: assMsgId,
            conversationId,
            role: "assistant",
            content: fullContent,
            sources: JSON.stringify(sources),
            createdAt: now(),
          });

          if (history.length === 0 && conversation.title === "New Chat") {
            const title = message.slice(0, 60) + (message.length > 60 ? "..." : "");
            await db
              .update(schema.conversations)
              .set({ title, updatedAt: now() })
              .where(eq(schema.conversations.id, conversationId));
          }

          await stream.writeSSE({
            event: "message",
            data: JSON.stringify({ type: "done", messageId: assMsgId, sources }),
          });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Generation failed";
          await stream.writeSSE({
            event: "message",
            data: JSON.stringify({ type: "error", message: errorMsg }),
          });
        }
      });
    } catch (error) {
      console.error("[Chat Error]", error);
      const msg = error instanceof Error ? error.message : "Failed to process chat";
      return c.json({ error: msg }, 500);
    }
  }
);

export default routes;
