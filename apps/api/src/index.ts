import { serve } from "@hono/node-server";
import { lt, or, isNotNull } from "drizzle-orm";
import { providerInfo } from "./ai/index.js";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { db, pool, schema } from "./db/client.js";
import { logger } from "./lib/logger.js";
import { resumePendingExtractions } from "./rag/extraction.js";
import { resumePendingDocuments } from "./rag/ingest.js";

const app = createApp();

const server = serve({ fetch: app.fetch, port: env.PORT, hostname: env.HOST }, (info) => {
  logger.info({ port: info.port, ai: providerInfo() }, `API de Folio escuchando en http://${env.HOST}:${info.port}`);
});

/** Limpieza periódica: sesiones caducadas y enlaces de recuperación usados o vencidos. */
async function cleanup(): Promise<void> {
  const now = new Date();
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, now));
  await db.delete(schema.passwordResets).where(or(lt(schema.passwordResets.expiresAt, now), isNotNull(schema.passwordResets.usedAt)));
}

const cleanupTimer = setInterval(() => cleanup().catch((err) => logger.warn({ err }, "limpieza fallida")), 60 * 60 * 1000);
cleanupTimer.unref();

resumePendingDocuments().catch((err) => logger.error({ err }, "no se pudieron reencolar documentos"));
resumePendingExtractions().catch((err) => logger.error({ err }, "no se pudieron reencolar extracciones"));

/** Apagado ordenado: deja de aceptar conexiones y cierra el pool. */
function shutdown(signal: string): void {
  logger.info({ signal }, "apagando la API");
  clearInterval(cleanupTimer);
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
