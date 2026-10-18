import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { providerInfo } from "./ai/index.js";
import { allowedOrigins, isProduction } from "./config/env.js";
import { db } from "./db/client.js";
import { HttpError } from "./lib/errors.js";
import { logger } from "./lib/logger.js";
import { loadUser, requireAdmin, requireAuth } from "./middleware/auth.js";
import { originCheck, requestLogger } from "./middleware/security.js";
import { workspaceMember } from "./middleware/workspace.js";
import { adminRoutes } from "./routes/admin.js";
import { authRoutes } from "./routes/auth.js";
import { publicBillingRoutes, workspaceBillingRoutes } from "./routes/billing.js";
import { conversationRoutes } from "./routes/conversations.js";
import { collectionRoutes, documentRoutes } from "./routes/documents.js";
import { extractionRoutes } from "./routes/extractions.js";
import { workspaceRootRoutes, workspaceRoutes } from "./routes/workspaces.js";
import type { AppEnv } from "./types.js";

export function createApp() {
  const app = new Hono<AppEnv>();

  app.use("*", requestLogger);
  app.use(
    "*",
    secureHeaders({
      crossOriginResourcePolicy: "same-origin",
      referrerPolicy: "strict-origin-when-cross-origin",
      xFrameOptions: "DENY",
      contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    }),
  );
  // En producción la web y la API comparten origen (nginx); CORS solo para orígenes declarados.
  app.use("/api/*", cors({ origin: (origin) => (allowedOrigins.includes(origin) ? origin : null), credentials: true, maxAge: 600 }));
  app.use("/api/*", originCheck);

  /** Healthcheck público: comprueba la base, sin datos internos. */
  app.get("/api/health", async (c) => {
    try {
      await db.execute(sql`SELECT 1`);
      return c.json({ status: "ok", db: "ok", time: new Date().toISOString() });
    } catch {
      return c.json({ status: "error", db: "down" }, 503);
    }
  });

  // Webhooks y planes: públicos (los webhooks se verifican por firma).
  app.route("/api/billing", publicBillingRoutes);

  app.use("/api/*", loadUser);
  app.get("/api/meta", (c) => c.json({ ai: providerInfo() }));
  app.route("/api/auth", authRoutes);

  // La sesión se exige POR PREFIJO (no con un "*" global bajo /api): así una
  // ruta inexistente responde 404 y no 401.
  for (const prefix of ["/api/workspaces", "/api/workspaces/*", "/api/invitations/*"]) app.use(prefix, requireAuth);
  for (const prefix of ["/api/admin", "/api/admin/*"]) app.use(prefix, requireAdmin);
  app.route("/api", workspaceRootRoutes);

  const ws = new Hono<AppEnv>();
  ws.use("*", workspaceMember);
  ws.route("/", workspaceRoutes);
  ws.route("/collections", collectionRoutes);
  ws.route("/documents", documentRoutes);
  ws.route("/conversations", conversationRoutes);
  ws.route("/extractions", extractionRoutes);
  ws.route("/billing", workspaceBillingRoutes);
  app.route("/api/workspaces/:workspaceId", ws);
  app.route("/api/admin", adminRoutes);

  app.notFound((c) => c.json({ error: "Ruta no encontrada", code: "NOT_FOUND" }, 404));

  app.onError((error, c) => {
    if (error instanceof HttpError) {
      return c.json({ error: error.message, code: error.code, ...(error.details ? { details: error.details } : {}) }, error.status);
    }
    if (error instanceof HTTPException) {
      return c.json({ error: error.message || "Petición inválida", code: "HTTP_ERROR" }, error.status);
    }
    // Unicidad violada en una carrera (dos subidas idénticas a la vez, etc.).
    if (typeof error === "object" && error && "code" in error && (error as { code?: string }).code === "23505") {
      return c.json({ error: "El recurso ya existe", code: "CONFLICT" }, 409);
    }
    logger.error({ err: error, path: c.req.path, requestId: c.get("requestId") }, "error no controlado");
    return c.json({ error: isProduction ? "Error interno del servidor" : (error as Error).message || "Error interno", code: "INTERNAL" }, 500);
  });

  return app;
}
