import { Router } from "express";
import { db, schema } from "../db/index.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { uuid, now } from "../lib/utils.js";
import { eq, and, desc, sql } from "drizzle-orm";

function first<T>(rows: T[]): T | undefined {
  return rows[0];
}

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const conversations = await db
      .select({
        id: schema.conversations.id,
        title: schema.conversations.title,
        createdAt: schema.conversations.createdAt,
        updatedAt: schema.conversations.updatedAt,
        messageCount:
          sql<number>`count(distinct ${schema.messages.id})`.as("message_count"),
        documentCount:
          sql<number>`count(distinct ${schema.conversationDocuments.documentId})`.as(
            "document_count"
          ),
      })
      .from(schema.conversations)
      .where(eq(schema.conversations.userId, req.user!.userId))
      .leftJoin(
        schema.messages,
        eq(schema.messages.conversationId, schema.conversations.id)
      )
      .leftJoin(
        schema.conversationDocuments,
        eq(schema.conversationDocuments.conversationId, schema.conversations.id)
      )
      .groupBy(schema.conversations.id)
      .orderBy(desc(schema.conversations.updatedAt));

    res.json({ conversations });
  } catch (error) {
    console.error("[List Conversations Error]", error);
    res.status(500).json({ error: "Failed to list conversations" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const timestamp = now();
    const id = uuid();

    await db.insert(schema.conversations).values({
      id,
      userId: req.user!.userId,
      title: body.title || "New Chat",
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    if (body.documentIds?.length > 0) {
      const userDocIds = new Set<string>();
      for (const docId of body.documentIds) {
        const doc = first(
          await db
            .select({ id: schema.documents.id })
            .from(schema.documents)
            .where(
              and(
                eq(schema.documents.id, docId),
                eq(schema.documents.userId, req.user!.userId)
              )
            )
        );
        if (doc) userDocIds.add(doc.id);
      }

      if (userDocIds.size > 0) {
        await db.insert(schema.conversationDocuments).values(
          Array.from(userDocIds).map((docId: string) => ({
            conversationId: id,
            documentId: docId,
          }))
        );
      }
    }

    const conversation = first(
      await db
        .select()
        .from(schema.conversations)
        .where(eq(schema.conversations.id, id))
    );

    res.status(201).json({ conversation });
  } catch (error) {
    console.error("[Create Conversation Error]", error);
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const conversation = first(
      await db
        .select()
        .from(schema.conversations)
        .where(eq(schema.conversations.id, id))
    );

    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    if (conversation.userId !== req.user!.userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const msgs = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, id))
      .orderBy(schema.messages.createdAt);

    const linkedDocs = await db
      .select({
        documentId: schema.conversationDocuments.documentId,
        filename: schema.documents.filename,
        originalName: schema.documents.originalName,
      })
      .from(schema.conversationDocuments)
      .innerJoin(
        schema.documents,
        eq(schema.documents.id, schema.conversationDocuments.documentId)
      )
      .where(eq(schema.conversationDocuments.conversationId, id));

    res.json({
      conversation,
      messages: msgs,
      documents: linkedDocs,
    });
  } catch (error) {
    console.error("[Get Conversation Error]", error);
    res.status(500).json({ error: "Failed to get conversation" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const conversation = first(
      await db
        .select()
        .from(schema.conversations)
        .where(eq(schema.conversations.id, id))
    );

    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    if (conversation.userId !== req.user!.userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    await db
      .delete(schema.conversations)
      .where(eq(schema.conversations.id, id));

    res.json({ success: true });
  } catch (error) {
    console.error("[Delete Conversation Error]", error);
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

export default router;
