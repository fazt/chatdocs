import { Hono } from "hono";
import path from "path";
import { db, schema } from "../db/index.js";
import { chunkMarkdown } from "../lib/chunker.js";
import { embedTexts } from "../lib/embeddings.js";
import { describeImage } from "../lib/vision.js";
import { uploadFile } from "../lib/storage.js";
import { uuid, now, first } from "../lib/utils.js";
import { requireAuth, type AuthEnv } from "../middleware/auth.middleware.js";
import {
  MAX_FILE_SIZE,
  MAX_IMAGE_SIZE,
  ALLOWED_EXTENSIONS,
  IMAGE_EXTENSIONS,
} from "../lib/constants.js";
import { eq } from "drizzle-orm";

const routes = new Hono<AuthEnv>();

routes.use("*", requireAuth);

function isImage(ext: string): boolean {
  return IMAGE_EXTENSIONS.includes(ext);
}

routes.get("/", async (c) => {
  const user = c.get("user")!;
  try {
    const docs = await db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.userId, user.userId))
      .orderBy(schema.documents.createdAt);
    return c.json({ documents: docs });
  } catch (error) {
    console.error("[List Documents Error]", error);
    return c.json({ error: "Failed to list documents" }, 500);
  }
});

routes.post("/", async (c) => {
  const user = c.get("user")!;
  try {
    const form = await c.req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return c.json({ error: "No file provided" }, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const originalname = file.name;
    const mimetype = file.type || "application/octet-stream";
    const ext = path.extname(originalname).toLowerCase();
    const image = isImage(ext);

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return c.json(
        { error: `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}` },
        400
      );
    }

    const maxSize = image ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;
    if (buffer.length > maxSize) {
      return c.json(
        { error: `File too large. Maximum size is ${maxSize / 1024 / 1024}MB` },
        400
      );
    }

    const timestamp = now();
    const docId = uuid();

    const extClean = ext.startsWith(".") ? ext : `.${ext}`;
    const key = `documents/${docId}${extClean}`;
    const url = await uploadFile(key, buffer, mimetype);

    if (image) {
      const description = await describeImage(buffer, mimetype);
      const [embedding] = await embedTexts([description]);

      await db.insert(schema.documents).values({
        id: docId,
        userId: user.userId,
        filename: originalname,
        originalName: originalname,
        mimeType: mimetype,
        size: buffer.length,
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

      return c.json(
        {
          id: docId,
          filename: originalname,
          size: buffer.length,
          type: "image",
          url,
          chunkCount: 1,
          description,
        },
        201
      );
    }

    const content = buffer.toString("utf-8");
    if (!content.trim()) {
      return c.json({ error: "File is empty" }, 400);
    }

    const rawChunks = chunkMarkdown(content);
    const embeddings = await embedTexts(rawChunks.map((ch) => ch.content));

    await db.insert(schema.documents).values({
      id: docId,
      userId: user.userId,
      filename: originalname,
      originalName: originalname,
      mimeType: mimetype,
      size: buffer.length,
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

    return c.json(
      {
        id: docId,
        filename: originalname,
        size: buffer.length,
        type: "markdown",
        url,
        chunkCount: rawChunks.length,
      },
      201
    );
  } catch (error) {
    console.error("[Upload Error]", error);
    const message = error instanceof Error ? error.message : "Failed to upload document";
    return c.json({ error: message }, 500);
  }
});

routes.delete("/:id", async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  try {
    const doc = first(
      await db.select().from(schema.documents).where(eq(schema.documents.id, id))
    );

    if (!doc) {
      return c.json({ error: "Document not found" }, 404);
    }
    if (doc.userId !== user.userId) {
      return c.json({ error: "Forbidden" }, 403);
    }

    await db.delete(schema.documents).where(eq(schema.documents.id, id));
    return c.json({ success: true });
  } catch (error) {
    console.error("[Delete Document Error]", error);
    return c.json({ error: "Failed to delete document" }, 500);
  }
});

export default routes;
