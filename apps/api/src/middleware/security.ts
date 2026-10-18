import { createMiddleware } from "hono/factory";
import { allowedOrigins } from "../config/env.js";
import { forbidden } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import type { AppEnv } from "../types.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Anti-CSRF: la cookie de sesión es SameSite=Lax, y además toda petición que
 * modifica algo debe venir de un origen permitido. Los webhooks de pago
 * (servidor a servidor, sin cookie) quedan fuera y se verifican por firma.
 */
export const originCheck = createMiddleware<AppEnv>(async (c, next) => {
  if (SAFE_METHODS.has(c.req.method) || c.req.path.startsWith("/api/billing/webhooks/")) return next();
  const origin = c.req.header("origin");
  const referer = c.req.header("referer");
  const source = origin ?? (referer ? safeOrigin(referer) : undefined);
  if (!source || !allowedOrigins.includes(source)) throw forbidden("Origen no permitido");
  await next();
});

function safeOrigin(url: string): string | undefined {
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

/** Log de acceso: método, RUTA SIN query string, estado y duración. */
export const requestLogger = createMiddleware<AppEnv>(async (c, next) => {
  const started = performance.now();
  const requestId = c.req.header("x-request-id")?.slice(0, 64) || crypto.randomUUID();
  c.set("requestId", requestId);
  c.header("X-Request-Id", requestId);
  await next();
  if (c.req.path === "/api/health") return;
  const status = c.res.status;
  const entry = {
    requestId,
    method: c.req.method,
    path: c.req.path,
    status,
    ms: Math.round(performance.now() - started),
    userId: c.get("user")?.id,
  };
  if (status >= 500) logger.error(entry, "request");
  else if (status >= 400) logger.warn(entry, "request");
  else logger.info(entry, "request");
});
