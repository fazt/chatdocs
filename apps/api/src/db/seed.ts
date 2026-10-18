import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { complete, llm } from "../ai/index.js";
import { env } from "../config/env.js";
import { sha256 } from "../lib/crypto.js";
import { hashPassword } from "../lib/password.js";
import { storage } from "../lib/storage.js";
import { buildCitations } from "../rag/citations.js";
import { processDocument } from "../rag/ingest.js";
import { buildUserContent, SYSTEM_PROMPT, toContextItems } from "../rag/prompt.js";
import { hybridSearch, searchPerDocument } from "../rag/retrieval.js";
import { runMigrations } from "./migrate.js";
import { db, pool, schema } from "./client.js";

/**
 * Seed IDEMPOTENTE: crea el administrador y (si SEED_DEMO=true) un estudio
 * jurídico de demo con expedientes, documentos indexados y conversaciones.
 * Si los datos ya existen no los duplica ni borra nada.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const SEED_DIR = path.resolve(here, "../../seed-data");
const DEMO_PASSWORD = "Demo12345!";
const DAY = 24 * 60 * 60 * 1000;

async function upsertUser(email: string, name: string, password: string, role: "user" | "admin" = "user") {
  const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  if (existing) return existing;
  const [user] = await db.insert(schema.users).values({ email, name, role, passwordHash: await hashPassword(password) }).returning();
  return user!;
}

async function addDocument(workspaceId: string, collectionId: string, file: string, title: string, uploadedById: string, metadata: Record<string, string>) {
  const buffer = await readFile(path.join(SEED_DIR, file));
  const id = crypto.randomUUID();
  const storageKey = `workspaces/${workspaceId}/${id}.md`;
  await storage.put(storageKey, buffer, "text/markdown");
  await db.insert(schema.documents).values({
    id,
    workspaceId,
    collectionId,
    title,
    originalName: file,
    mimeType: "text/markdown; charset=utf-8",
    kind: "markdown",
    sizeBytes: buffer.length,
    sha256: sha256(buffer),
    storageKey,
    status: "queued",
    uploadedById,
    metadata,
  });
  await processDocument(id);
  return id;
}

/** Hace una pregunta "de verdad" (recuperación + modelo + citas verificadas) y la guarda. */
async function ask(conversationId: string, workspaceId: string, userId: string, documentIds: string[], question: string, mode: "qa" | "compare") {
  const chunks =
    mode === "compare"
      ? await searchPerDocument({ workspaceId, documentIds, query: question, perDocument: 3 })
      : await hybridSearch({ workspaceId, documentIds, query: question });
  const context = toContextItems(chunks);
  const { text, usage, model } = await complete(llm, {
    system: SYSTEM_PROMPT,
    history: [],
    userContent: buildUserContent(question, context, mode),
    question,
    context,
    task: mode === "compare" ? "compare" : "answer",
  });
  const pageText = async (documentId: string, page: number) => {
    const rows = await db.select().from(schema.documentPages).where(eq(schema.documentPages.documentId, documentId));
    return rows.find((r) => r.pageNumber === page)?.text ?? "";
  };
  const citations = await buildCitations(text, chunks, pageText);
  await db.insert(schema.messages).values({ conversationId, userId, role: "user", content: question });
  await db.insert(schema.messages).values({ conversationId, role: "assistant", content: text, citations, usage: { ...usage, model } });
}

async function seedDemo() {
  const owner = await upsertUser("lucia@estudioquispe.pe", "Lucía Quispe Ramos", DEMO_PASSWORD);
  const editor = await upsertUser("andres@estudioquispe.pe", "Andrés Rojas Villanueva", DEMO_PASSWORD);
  const viewer = await upsertUser("paula@estudioquispe.pe", "Paula Medina Flores", DEMO_PASSWORD);
  const researcher = await upsertUser("rosa@pucp-demo.pe", "Rosa Elena Mamani", DEMO_PASSWORD);

  const [already] = await db.select().from(schema.workspaces).where(eq(schema.workspaces.name, "Estudio Quispe & Asociados"));
  if (already) {
    console.log("Demo ya sembrada: no se duplica.");
    return;
  }

  // --- Estudio jurídico (plan Equipo vigente) ---------------------------------
  const [firm] = await db
    .insert(schema.workspaces)
    .values({ name: "Estudio Quispe & Asociados", plan: "team", planExpiresAt: new Date(Date.now() + 24 * DAY), createdById: owner.id })
    .returning();
  await db.insert(schema.workspaceMembers).values([
    { workspaceId: firm!.id, userId: owner.id, role: "owner" },
    { workspaceId: firm!.id, userId: editor.id, role: "editor" },
    { workspaceId: firm!.id, userId: viewer.id, role: "viewer" },
  ]);
  const [contracts, compliance] = await db
    .insert(schema.collections)
    .values([
      {
        workspaceId: firm!.id,
        name: "Andes Analítica — contratos 2026",
        description: "Arrendamiento de la oficina de Miraflores y contrato de soporte TI del cliente.",
        kind: "legal",
        createdById: owner.id,
      },
      {
        workspaceId: firm!.id,
        name: "Andes Analítica — cumplimiento de datos personales",
        description: "Política interna y evidencias para la auditoría de la Ley 29733.",
        kind: "compliance",
        createdById: editor.id,
      },
    ])
    .returning();

  const lease = await addDocument(firm!.id, contracts!.id, "contrato-arrendamiento-oficina.md", "Contrato de arrendamiento — Oficina 702 Miraflores", owner.id, {
    parties: "Inmobiliaria Los Próceres S.A.C. / Andes Analítica S.A.C.",
    signedAt: "2026-02-15",
  });
  const it = await addDocument(firm!.id, contracts!.id, "contrato-servicios-ti.md", "Contrato de soporte TI — Nube Sur Tecnología", editor.id, {
    parties: "Andes Analítica S.A.C. / Nube Sur Tecnología E.I.R.L.",
    signedAt: "2026-03-20",
  });
  const policy = await addDocument(firm!.id, compliance!.id, "politica-proteccion-datos.md", "Política de protección de datos personales v3.1", editor.id, {
    reference: "Ley N.° 29733 y su reglamento",
  });

  const [qa] = await db
    .insert(schema.conversations)
    .values({ workspaceId: firm!.id, collectionId: contracts!.id, userId: owner.id, title: "Preaviso y penalidades del arrendamiento", mode: "qa" })
    .returning();
  await db.insert(schema.conversationDocuments).values({ conversationId: qa!.id, documentId: lease });
  await ask(qa!.id, firm!.id, owner.id, [lease], "¿Con cuánta anticipación hay que avisar para no renovar y qué penalidad hay si salimos antes?", "qa");

  const [cmp] = await db
    .insert(schema.conversations)
    .values({ workspaceId: firm!.id, collectionId: contracts!.id, userId: editor.id, title: "Comparar confidencialidad y resolución", mode: "compare" })
    .returning();
  await db.insert(schema.conversationDocuments).values([
    { conversationId: cmp!.id, documentId: lease },
    { conversationId: cmp!.id, documentId: it },
  ]);
  await ask(cmp!.id, firm!.id, editor.id, [lease, it], "Compara la confidencialidad, la resolución anticipada y la jurisdicción de ambos contratos", "compare");

  const [dp] = await db
    .insert(schema.conversations)
    .values({ workspaceId: firm!.id, collectionId: compliance!.id, userId: viewer.id, title: "Plazos ante un incidente de seguridad", mode: "qa" })
    .returning();
  await ask(dp!.id, firm!.id, viewer.id, [policy], "¿En qué plazo se debe reportar un incidente de seguridad con datos personales?", "qa");

  await db.insert(schema.extractions).values({
    workspaceId: firm!.id,
    collectionId: contracts!.id,
    name: "Cláusulas clave — contratos de Andes Analítica",
    templateKey: "contrato",
    fields: [
      { key: "vigencia", label: "Vigencia y renovación", instructions: "Fecha de inicio, duración, plazo y si se renueva automáticamente." },
      { key: "pago", label: "Precio y forma de pago", instructions: "Montos, moneda, periodicidad y plazos de pago." },
      { key: "terminacion", label: "Terminación", instructions: "Causales de resolución o terminación anticipada y preaviso requerido." },
      { key: "jurisdiccion", label: "Ley aplicable y jurisdicción", instructions: "Ley que rige el contrato y tribunal o arbitraje para controversias." },
    ],
    documentIds: [lease, it],
    status: "queued",
    createdById: owner.id,
  });

  await db.insert(schema.auditLogs).values([
    { workspaceId: firm!.id, userId: owner.id, action: "document.uploaded", targetType: "document", targetId: lease, meta: { title: "Contrato de arrendamiento — Oficina 702 Miraflores" } },
    { workspaceId: firm!.id, userId: editor.id, action: "document.uploaded", targetType: "document", targetId: it, meta: { title: "Contrato de soporte TI — Nube Sur Tecnología" } },
    { workspaceId: firm!.id, userId: editor.id, action: "document.uploaded", targetType: "document", targetId: policy, meta: { title: "Política de protección de datos personales v3.1" } },
    { workspaceId: firm!.id, userId: owner.id, action: "conversation.exported", targetType: "conversation", targetId: qa!.id, meta: { format: "html" } },
  ]);

  const [payment] = await db
    .insert(schema.payments)
    .values({
      workspaceId: firm!.id,
      userId: owner.id,
      provider: "stripe",
      plan: "team",
      status: "paid",
      amountCents: 5900,
      currency: "USD",
      chargeCents: 5900,
      chargeCurrency: "USD",
      days: 30,
      providerRef: "cs_test_demo_folio",
      captureRef: "pi_test_demo_folio",
      paidAt: new Date(Date.now() - 6 * DAY),
    })
    .returning();
  void payment;

  // --- Investigadora con plan Gratis -----------------------------------------
  const [lab] = await db.insert(schema.workspaces).values({ name: "Tesis — Teletrabajo y productividad", createdById: researcher.id }).returning();
  await db.insert(schema.workspaceMembers).values({ workspaceId: lab!.id, userId: researcher.id, role: "owner" });
  const [papers] = await db
    .insert(schema.collections)
    .values({ workspaceId: lab!.id, name: "Bibliografía capítulo 2", description: "Artículos sobre teletrabajo en el Perú.", kind: "research", createdById: researcher.id })
    .returning();
  const paper = await addDocument(lab!.id, papers!.id, "paper-teletrabajo-productividad.md", "Teletrabajo híbrido y productividad en Lima (2025)", researcher.id, {
    authors: "Mamani Quispe, R. E.; Paredes Luna, J. A.",
    year: "2025",
    doi: "10.5555/rag.2025.142.03",
  });
  const [thesis] = await db
    .insert(schema.conversations)
    .values({ workspaceId: lab!.id, collectionId: papers!.id, userId: researcher.id, title: "Resultados y limitaciones del estudio", mode: "qa" })
    .returning();
  await ask(thesis!.id, lab!.id, researcher.id, [paper], "¿Cuál es el efecto del teletrabajo híbrido en la productividad y qué limitaciones reconocen los autores?", "qa");

  console.log("Demo sembrada: Estudio Quispe & Asociados (plan Equipo) y Tesis — Teletrabajo (plan Gratis).");
}

async function main() {
  await runMigrations();
  await upsertUser(env.SEED_ADMIN_EMAIL.toLowerCase(), "Administración Folio", env.SEED_ADMIN_PASSWORD, "admin");
  console.log(`Administrador: ${env.SEED_ADMIN_EMAIL}`);
  if (env.SEED_DEMO) await seedDemo();
}

main()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error("Error en el seed:", error);
    await pool.end();
    process.exit(1);
  });
