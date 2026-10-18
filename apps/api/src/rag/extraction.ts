import { and, eq, inArray } from "drizzle-orm";
import { complete, llm } from "../ai/index.js";
import { env } from "../config/env.js";
import { db, schema } from "../db/client.js";
import type { ExtractionField } from "../db/schema.js";
import { logger } from "../lib/logger.js";
import { truncate } from "../lib/text.js";
import { quoteAppearsIn } from "./citations.js";
import { buildExtractionContent, EXTRACTION_SYSTEM_PROMPT, toContextItems } from "./prompt.js";
import { hybridSearch } from "./retrieval.js";

export interface ExtractionTemplate {
  key: string;
  name: string;
  description: string;
  fields: ExtractionField[];
}

const f = (key: string, label: string, instructions: string): ExtractionField => ({ key, label, instructions });

/** Plantillas de extracción listas para usar (se pueden editar o crear campos propios). */
export const EXTRACTION_TEMPLATES: ExtractionTemplate[] = [
  {
    key: "contrato",
    name: "Contrato: cláusulas clave",
    description: "Partes, objeto, vigencia, pagos, terminación, confidencialidad, penalidades y jurisdicción.",
    fields: [
      f("partes", "Partes", "Quiénes firman el contrato y en qué calidad (razón social, representantes)."),
      f("objeto", "Objeto", "Qué se contrata o cuál es el objeto del contrato."),
      f("vigencia", "Vigencia y renovación", "Fecha de inicio, duración, plazo y si se renueva automáticamente."),
      f("pago", "Precio y forma de pago", "Montos, moneda, periodicidad y plazos de pago."),
      f("terminacion", "Terminación", "Causales de resolución o terminación anticipada y preaviso requerido."),
      f("confidencialidad", "Confidencialidad", "Obligaciones de confidencialidad y su duración."),
      f("penalidades", "Penalidades", "Multas, penalidades o indemnizaciones por incumplimiento."),
      f("jurisdiccion", "Ley aplicable y jurisdicción", "Ley que rige el contrato y tribunal o arbitraje para controversias."),
    ],
  },
  {
    key: "cumplimiento",
    name: "Política o norma: cumplimiento",
    description: "Alcance, responsables, obligaciones, plazos, datos personales y sanciones.",
    fields: [
      f("alcance", "Alcance", "A quién o a qué procesos aplica la política o norma."),
      f("responsables", "Responsables", "Áreas o cargos responsables de cumplirla o supervisarla."),
      f("obligaciones", "Obligaciones principales", "Obligaciones concretas que impone."),
      f("plazos", "Plazos", "Plazos, frecuencias o fechas límite que establece."),
      f("datos_personales", "Datos personales", "Disposiciones sobre tratamiento o protección de datos personales."),
      f("sanciones", "Sanciones", "Consecuencias o sanciones por incumplimiento."),
    ],
  },
  {
    key: "paper",
    name: "Artículo académico: ficha de lectura",
    description: "Pregunta de investigación, método, muestra, resultados, limitaciones y financiamiento.",
    fields: [
      f("pregunta", "Pregunta u objetivo", "Pregunta de investigación, hipótesis u objetivo principal del estudio."),
      f("metodo", "Metodología", "Diseño del estudio y métodos de análisis."),
      f("muestra", "Muestra y datos", "Tamaño de la muestra, población, periodo y fuentes de datos."),
      f("resultados", "Resultados principales", "Hallazgos principales con sus cifras."),
      f("limitaciones", "Limitaciones", "Limitaciones que reconocen los autores."),
      f("financiamiento", "Financiamiento y conflictos", "Fuentes de financiamiento y conflictos de interés declarados."),
    ],
  },
];

interface ParsedExtraction {
  found: boolean;
  value: string;
  quote: string | null;
  source: number | null;
}

/** Parsea la respuesta del modelo con tolerancia (texto alrededor, bloque ```json). */
export function parseExtractionOutput(text: string): ParsedExtraction {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return { found: false, value: "No se pudo interpretar la respuesta", quote: null, source: null };
  try {
    const json = JSON.parse(text.slice(start, end + 1)) as Partial<Record<keyof ParsedExtraction, unknown>>;
    const found = json.found !== false;
    return {
      found,
      value: typeof json.value === "string" && json.value.trim() ? truncate(json.value.trim(), 1000) : found ? "—" : "No consta en el documento",
      quote: typeof json.quote === "string" && json.quote.trim() ? truncate(json.quote.trim(), 1200) : null,
      source: typeof json.source === "number" && Number.isInteger(json.source) ? json.source : null,
    };
  } catch {
    return { found: false, value: "No se pudo interpretar la respuesta", quote: null, source: null };
  }
}

/**
 * Ejecuta una extracción: por cada documento y campo, recupera los fragmentos
 * más relevantes DE ESE documento, pide el dato y verifica la cita literal.
 */
export async function runExtraction(extractionId: string): Promise<void> {
  const [extraction] = await db
    .update(schema.extractions)
    .set({ status: "running", error: null })
    .where(and(eq(schema.extractions.id, extractionId), eq(schema.extractions.status, "queued")))
    .returning();
  if (!extraction) return;

  try {
    const docs = await db
      .select({ id: schema.documents.id })
      .from(schema.documents)
      .where(
        and(
          eq(schema.documents.workspaceId, extraction.workspaceId),
          inArray(schema.documents.id, extraction.documentIds),
          eq(schema.documents.status, "ready"),
        ),
      );

    for (const doc of docs) {
      for (const field of extraction.fields) {
        const chunks = await hybridSearch({
          workspaceId: extraction.workspaceId,
          documentIds: [doc.id],
          query: `${field.label}. ${field.instructions}`,
          limit: 5,
        });
        if (chunks.length === 0) continue;
        const context = toContextItems(chunks);
        const { text } = await complete(llm, {
          system: EXTRACTION_SYSTEM_PROMPT,
          history: [],
          userContent: buildExtractionContent(field, context),
          question: `${field.label} ${field.instructions}`,
          context,
          task: "extract",
          maxTokens: 1500,
        });
        const parsed = parseExtractionOutput(text);
        const chunk = parsed.source ? chunks[parsed.source - 1] : undefined;
        const verified = Boolean(parsed.quote && chunk && quoteAppearsIn(parsed.quote, chunk.content));
        await db
          .insert(schema.extractionResults)
          .values({
            extractionId: extraction.id,
            documentId: doc.id,
            fieldKey: field.key,
            value: parsed.value,
            quote: parsed.quote,
            page: chunk?.page ?? null,
            verified,
            found: parsed.found,
            score: chunk?.score ?? null,
          })
          .onConflictDoUpdate({
            target: [schema.extractionResults.extractionId, schema.extractionResults.documentId, schema.extractionResults.fieldKey],
            set: { value: parsed.value, quote: parsed.quote, page: chunk?.page ?? null, verified, found: parsed.found },
          });
      }
    }
    await db.update(schema.extractions).set({ status: "done", finishedAt: new Date() }).where(eq(schema.extractions.id, extraction.id));
  } catch (error) {
    logger.error({ err: error, extractionId }, "falló la extracción");
    await db
      .update(schema.extractions)
      .set({ status: "failed", error: "La extracción falló; revisa el proveedor de IA y vuelve a intentarlo", finishedAt: new Date() })
      .where(eq(schema.extractions.id, extraction.id));
  }
}

/** Las extracciones corren en segundo plano, de a una (son muchas llamadas al modelo). */
let chain: Promise<void> = Promise.resolve();
export function enqueueExtraction(extractionId: string): void {
  if (!env.WORKERS_ENABLED) return;
  chain = chain.then(() => runExtraction(extractionId)).catch(() => undefined);
}

/** Al arrancar: las que quedaron a medias por un reinicio se vuelven a ejecutar. */
export async function resumePendingExtractions(): Promise<void> {
  if (!env.WORKERS_ENABLED) return;
  const rows = await db
    .update(schema.extractions)
    .set({ status: "queued" })
    .where(inArray(schema.extractions.status, ["queued", "running"]))
    .returning({ id: schema.extractions.id });
  for (const row of rows) enqueueExtraction(row.id);
}
