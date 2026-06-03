import { Router } from "express";
import multer from "multer";
import path from "path";
import { db, schema } from "../db/index.js";
import { chunkMarkdown } from "../lib/chunker.js";
import { embedText, embedTexts } from "../lib/embeddings.js";
import { describeImage } from "../lib/vision.js";
import { uploadFile } from "../lib/storage.js";
import { uuid, now } from "../lib/utils.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { MAX_FILE_SIZE, MAX_IMAGE_SIZE, ALLOWED_EXTENSIONS, IMAGE_EXTENSIONS } from "../lib/constants.js";
import { eq } from "drizzle-orm";

function first<T>(rows: T[]): T | undefined {
  return rows[0];
}

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.max(MAX_FILE_SIZE, MAX_IMAGE_SIZE) },
});

function isImage(ext: string): boolean {
  return IMAGE_EXTENSIONS.includes(ext);
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const docs = await db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.userId, req.user!.userId))
      .orderBy(schema.documents.createdAt);

    res.json({ documents: docs });
  } catch (error) {
    console.error("[List Documents Error]", error);
    res.status(500).json({ error: "Failed to list documents" });
  }
});

router.post("/", requireAuth, upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    const ext = path.extname(file.originalname).toLowerCase();
    const image = isImage(ext);

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      res.status(400).json({
        error: `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
      });
      return;
    }

    const maxSize = image ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;
    if (file.size > maxSize) {
      res.status(400).json({
        error: `File too large. Maximum size is ${maxSize / 1024 / 1024}MB`,
      });
      return;
    }

    const timestamp = now();
    const docId = uuid();

    // Upload original file to Spaces
    const extClean = ext.startsWith(".") ? ext : `.${ext}`;
    const key = `documents/${docId}${extClean}`;
    const url = await uploadFile(key, file.buffer, file.mimetype || "application/octet-stream");

    if (image) {
      // ——— Image upload ———
      const description = await describeImage(file.buffer, file.mimetype || "image/png");
      const [embedding] = await embedTexts([description]);

      await db.insert(schema.documents).values({
        id: docId,
        userId: req.user!.userId,
        filename: file.originalname,
        originalName: file.originalname,
        mimeType: file.mimetype || "image/png",
        size: file.size,
        type: "image",
        url,
        chunkCount: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      await db.insert(schema.chunks).values({
        id: uuid(),
        documentId: docId,
        content: description,
        embedding: JSON.stringify(embedding),
        heading: "",
        chunkIndex: 0,
        tokenCount: Math.ceil(description.length / 4),
        createdAt: timestamp,
      });

      res.status(201).json({
        id: docId,
        filename: file.originalname,
        size: file.size,
        type: "image",
        url,
        chunkCount: 1,
        description,
      });
    } else {
      // ——— Markdown upload ———
      const content = file.buffer.toString("utf-8");
      if (!content.trim()) {
        res.status(400).json({ error: "File is empty" });
        return;
      }

      const rawChunks = chunkMarkdown(content);
      const embeddings = await embedTexts(rawChunks.map((c) => c.content));

      await db.insert(schema.documents).values({
        id: docId,
        userId: req.user!.userId,
        filename: file.originalname,
        originalName: file.originalname,
        mimeType: file.mimetype || "text/markdown",
        size: file.size,
        type: "markdown",
        url,
        chunkCount: rawChunks.length,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      if (rawChunks.length > 0) {
        await db.insert(schema.chunks).values(
          rawChunks.map((chunk, i) => ({
            id: chunk.id,
            documentId: docId,
            content: chunk.content,
            embedding: JSON.stringify(embeddings[i]),
            heading: chunk.heading,
            chunkIndex: chunk.chunkIndex,
            tokenCount: chunk.tokenCount,
            createdAt: timestamp,
          }))
        );
      }

      res.status(201).json({
        id: docId,
        filename: file.originalname,
        size: file.size,
        type: "markdown",
        url,
        chunkCount: rawChunks.length,
      });
    }
  } catch (error) {
    console.error("[Upload Error]", error);
    const message = error instanceof Error ? error.message : "Failed to upload document";
    res.status(500).json({ error: message });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const doc = first(
      await db
        .select()
        .from(schema.documents)
        .where(eq(schema.documents.id, id))
    );

    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    if (doc.userId !== req.user!.userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    await db.delete(schema.documents).where(eq(schema.documents.id, id));
    res.json({ success: true });
  } catch (error) {
    console.error("[Delete Document Error]", error);
    res.status(500).json({ error: "Failed to delete document" });
  }
});

export default router;
