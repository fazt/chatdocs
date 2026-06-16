import { Router } from "express";
import { db, schema } from "../db/index.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { uuid, now, first } from "../lib/utils.js";
import { embedText } from "../lib/embeddings.js";
import { topK } from "../lib/vector.js";
import { buildSystemPrompt, streamChatCompletion, buildSources } from "../lib/chat.js";
import { TOP_K_CHUNKS } from "../lib/constants.js";
import { eq, and, inArray } from "drizzle-orm";
import { validate } from "../middleware/validate.js";
import { conversationIdParamSchema, chatMessageSchema } from "../schemas/chat.schema.js";
import type { z } from "zod";

const router = Router();

router.post(
  "/:conversationId",
  requireAuth,
  validate(conversationIdParamSchema, "params"),
  validate(chatMessageSchema),
  async (req, res) => {
    try {
      const { conversationId } = req.params as z.infer<typeof conversationIdParamSchema>;
      const { message } = req.body as z.infer<typeof chatMessageSchema>;

    const conversation = first(
      await db
        .select()
        .from(schema.conversations)
        .where(eq(schema.conversations.id, conversationId))
    );

    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    if (conversation.userId !== req.user!.userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    // Get linked document IDs
    const linked = await db
      .select()
      .from(schema.conversationDocuments)
      .where(eq(schema.conversationDocuments.conversationId, conversationId));

    if (linked.length === 0) {
      res.status(400).json({
        error:
          "No documents linked to this conversation. Please upload a document first and link it to the conversation.",
      });
      return;
    }

    const documentIds = linked.map((l) => l.documentId);

    const docs = await db
      .select()
      .from(schema.documents)
      .where(
        and(
          inArray(schema.documents.id, documentIds),
          eq(schema.documents.userId, req.user!.userId)
        )
      );

    const docMap = new Map(docs.map((d) => [d.id, d.filename]));
    const imageDocs = docs.filter((d) => d.type === "image" && d.url);

    const allChunks = await db
      .select()
      .from(schema.chunks)
      .where(inArray(schema.chunks.documentId, documentIds));

    if (allChunks.length === 0) {
      res.status(400).json({
        error: "No chunks found for the linked documents",
      });
      return;
    }

    const queryEmbedding = await embedText(message);
    const topChunks = topK(queryEmbedding, allChunks, TOP_K_CHUNKS);

    // Get message history (last 10)
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

    // Build system prompt
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

    // Save user message
    const userMsgId = uuid();
    const timestamp = now();
    await db.insert(schema.messages).values({
      id: userMsgId,
      conversationId,
      role: "user",
      content: message,
      createdAt: timestamp,
    });

    // Set SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    try {
      let fullContent = "";
      const assMsgId = uuid();

      // Build user message — include image URLs if linked docs are images
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

      const gen = streamChatCompletion(
        systemPrompt,
        [...historyMessages, { role: "user" as const, content: userMsgContent }]
      );

      for await (const delta of gen) {
        fullContent += delta;
        res.write(`data: ${JSON.stringify({ type: "delta", content: delta })}\n\n`);
      }

      // Save assistant message
      await db.insert(schema.messages).values({
        id: assMsgId,
        conversationId,
        role: "assistant",
        content: fullContent,
        sources: JSON.stringify(sources),
        createdAt: now(),
      });

      // Auto-title
      if (history.length === 0 && conversation.title === "New Chat") {
        const title = message.slice(0, 60) + (message.length > 60 ? "..." : "");
        await db
          .update(schema.conversations)
          .set({ title, updatedAt: now() })
          .where(eq(schema.conversations.id, conversationId));
      }

      res.write(`data: ${JSON.stringify({ type: "done", messageId: assMsgId, sources })}\n\n`);
      res.end();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Generation failed";
      res.write(`data: ${JSON.stringify({ type: "error", message: errorMsg })}\n\n`);
      res.end();
    }
  } catch (error) {
    console.error("[Chat Error]", error);
    const message = error instanceof Error ? error.message : "Failed to process chat";
    res.status(500).json({ error: message });
  }
});

export default router;
