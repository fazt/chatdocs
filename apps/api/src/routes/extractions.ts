import { Hono } from "hono";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../db/client.js";
import { audit } from "../lib/audit.js";
import { badRequest, notFound } from "../lib/errors.js";
import { contentDisposition } from "../lib/text.js";
import { consumeUsage } from "../lib/usage.js";
import { currentUser } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { currentWorkspace, requireRole } from "../middleware/workspace.js";
import { enqueueExtraction, EXTRACTION_TEMPLATES } from "../rag/extraction.js";
import type { AppEnv } from "../types.js";

const fieldSchema = z.object({
  key: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]{1,40}$/, "Clave: minúsculas, números y _"),
  label: z.string().trim().min(1).max(80),
  instructions: z.string().trim().min(3).max(400),
});

const createSchema = z
  .object({
    collectionId: z.uuid(),
    name: z.string().trim().min(1).max(120),
    templateKey: z.string().max(40).default("custom"),
    fields: z.array(fieldSchema).min(1).max(15),
    documentIds: z.array(z.uuid()).min(1).max(50),
  })
  .refine((v) => new Set(v.fields.map((f) => f.key)).size === v.fields.length, { message: "Hay campos con la misma clave", path: ["fields"] });

const extractionParam = z.object({ workspaceId: z.uuid(), extractionId: z.uuid() });

async function findExtraction(workspaceId: string, extractionId: string) {
  const [row] = await db
    .select()
    .from(schema.extractions)
    .where(and(eq(schema.extractions.id, extractionId), eq(schema.extractions.workspaceId, workspaceId)));
  if (!row) throw notFound("Extracción no encontrada");
  return row;
}

/** CSV con BOM (Excel lo abre con tildes) y celdas protegidas contra inyección de fórmulas. */
function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export const extractionRoutes = new Hono<AppEnv>()
  .get("/templates", (c) => c.json({ templates: EXTRACTION_TEMPLATES }))

  .get("/", async (c) => {
    const workspace = currentWorkspace(c);
    const rows = await db
      .select({
        id: schema.extractions.id,
        name: schema.extractions.name,
        collectionId: schema.extractions.collectionId,
        templateKey: schema.extractions.templateKey,
        status: schema.extractions.status,
        fields: schema.extractions.fields,
        documentIds: schema.extractions.documentIds,
        createdAt: schema.extractions.createdAt,
        finishedAt: schema.extractions.finishedAt,
      })
      .from(schema.extractions)
      .where(eq(schema.extractions.workspaceId, workspace.id))
      .orderBy(desc(schema.extractions.createdAt))
      .limit(100);
    return c.json({
      extractions: rows.map(({ fields, documentIds, ...rest }) => ({ ...rest, fieldCount: fields.length, documentCount: documentIds.length })),
    });
  })

  .post("/", requireRole("editor"), validate("json", createSchema), async (c) => {
    const workspace = currentWorkspace(c);
    const body = c.req.valid("json");
    const docs = await db
      .select({ id: schema.documents.id, status: schema.documents.status })
      .from(schema.documents)
      .where(and(eq(schema.documents.workspaceId, workspace.id), eq(schema.documents.collectionId, body.collectionId), inArray(schema.documents.id, body.documentIds)));
    if (docs.length !== new Set(body.documentIds).size) throw badRequest("Algún documento no existe o no pertenece a este expediente");
    if (docs.some((d) => d.status !== "ready")) throw badRequest("Todos los documentos deben estar indexados (estado «listo»)");

    await consumeUsage(workspace.id, workspace.plan, "extractions");
    const [extraction] = await db
      .insert(schema.extractions)
      .values({
        workspaceId: workspace.id,
        collectionId: body.collectionId,
        name: body.name,
        templateKey: body.templateKey,
        fields: body.fields,
        documentIds: docs.map((d) => d.id),
        createdById: currentUser(c).id,
      })
      .returning();
    enqueueExtraction(extraction!.id);
    await audit(c, workspace.id, "extraction.created", { type: "extraction", id: extraction!.id }, { fields: body.fields.length, documents: docs.length });
    return c.json({ extraction }, 202);
  })

  .get("/:extractionId", validate("param", extractionParam), async (c) => {
    const workspace = currentWorkspace(c);
    const extraction = await findExtraction(workspace.id, c.req.valid("param").extractionId);
    const [results, documents] = await Promise.all([
      db.select().from(schema.extractionResults).where(eq(schema.extractionResults.extractionId, extraction.id)),
      db
        .select({ id: schema.documents.id, title: schema.documents.title, kind: schema.documents.kind })
        .from(schema.documents)
        .where(and(eq(schema.documents.workspaceId, workspace.id), inArray(schema.documents.id, extraction.documentIds)))
        .orderBy(asc(schema.documents.title)),
    ]);
    return c.json({ extraction, documents, results });
  })

  .delete("/:extractionId", requireRole("editor"), validate("param", extractionParam), async (c) => {
    const workspace = currentWorkspace(c);
    const extraction = await findExtraction(workspace.id, c.req.valid("param").extractionId);
    await db.delete(schema.extractions).where(eq(schema.extractions.id, extraction.id));
    await audit(c, workspace.id, "extraction.deleted", { type: "extraction", id: extraction.id });
    return c.json({ ok: true });
  })

  .get("/:extractionId/export", validate("param", extractionParam), async (c) => {
    const workspace = currentWorkspace(c);
    const extraction = await findExtraction(workspace.id, c.req.valid("param").extractionId);
    const [results, documents] = await Promise.all([
      db.select().from(schema.extractionResults).where(eq(schema.extractionResults.extractionId, extraction.id)),
      db
        .select({ id: schema.documents.id, title: schema.documents.title, kind: schema.documents.kind })
        .from(schema.documents)
        .where(and(eq(schema.documents.workspaceId, workspace.id), inArray(schema.documents.id, extraction.documentIds)))
        .orderBy(asc(schema.documents.title)),
    ]);
    const header = ["Documento", "Campo", "Valor", "Cita literal", "Página/sección", "Cita verificada"];
    const rows = [header.map(csvCell).join(",")];
    for (const doc of documents) {
      for (const field of extraction.fields) {
        const r = results.find((x) => x.documentId === doc.id && x.fieldKey === field.key);
        rows.push(
          [doc.title, field.label, r?.value ?? "Sin resultado", r?.quote ?? "", r?.page ?? "", r ? (r.verified ? "sí" : "no") : ""].map(csvCell).join(","),
        );
      }
    }
    await audit(c, workspace.id, "extraction.exported", { type: "extraction", id: extraction.id });
    return c.body(`﻿${rows.join("\r\n")}\r\n`, 200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": contentDisposition(`${extraction.name}.csv`),
      "Cache-Control": "private, no-store",
    });
  });
