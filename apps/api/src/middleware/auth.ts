import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { and, eq, gt, isNull } from "drizzle-orm";
import { env } from "../config/env.js";
import { db, schema } from "../db/client.js";
import { randomToken, sha256 } from "../lib/crypto.js";
import { forbidden, unauthorized } from "../lib/errors.js";
import { clientIp, userAgent } from "../lib/request.js";
import type { AppEnv, SessionUser } from "../types.js";

export const SESSION_COOKIE = "folio_session";
const DAY = 24 * 60 * 60 * 1000;
/** No se escribe `last_used_at` en cada petición: como mucho cada 10 minutos. */
const TOUCH_EVERY_MS = 10 * 60 * 1000;

/**
 * Sesiones opacas en base de datos (el original usaba un JWT de 7 días con el
 * rol dentro: degradar a un admin no surtía efecto hasta que caducaba). Aquí la
 * cookie solo lleva un token aleatorio; el usuario y su rol se leen de la base
 * en cada petición y cerrar sesión revoca de verdad.
 */
export async function createSession(c: Context, userId: string): Promise<void> {
  const token = randomToken();
  await db.insert(schema.sessions).values({
    userId,
    tokenHash: sha256(token),
    userAgent: userAgent(c),
    ip: clientIp(c),
    expiresAt: new Date(Date.now() + env.SESSION_DAYS * DAY),
  });
  setCookie(c, SESSION_COOKIE, token, {
    path: "/",
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "Lax",
    maxAge: env.SESSION_DAYS * 24 * 60 * 60,
  });
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, SESSION_COOKIE, { path: "/", secure: env.COOKIE_SECURE });
}

async function loadSession(token: string): Promise<SessionUser | null> {
  const [row] = await db
    .select({
      sessionId: schema.sessions.id,
      lastUsedAt: schema.sessions.lastUsedAt,
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.users.role,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(
      and(eq(schema.sessions.tokenHash, sha256(token)), gt(schema.sessions.expiresAt, new Date()), isNull(schema.users.disabledAt)),
    )
    .limit(1);
  if (!row) return null;

  if (Date.now() - row.lastUsedAt.getTime() > TOUCH_EVERY_MS) {
    await db.update(schema.sessions).set({ lastUsedAt: new Date() }).where(eq(schema.sessions.id, row.sessionId));
  }
  return { id: row.id, email: row.email, name: row.name, role: row.role, sessionId: row.sessionId };
}

/** Carga el usuario si hay cookie válida (no exige sesión). */
export const loadUser = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    const user = await loadSession(token);
    if (user) c.set("user", user);
  }
  await next();
});

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get("user")) throw unauthorized();
  await next();
});

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get("user");
  if (!user) throw unauthorized();
  if (user.role !== "admin") throw forbidden("Solo para administradores");
  await next();
});

/** Usuario de la petición (las rutas que lo usan van detrás de requireAuth). */
export function currentUser(c: Context<AppEnv>): SessionUser {
  const user = c.get("user");
  if (!user) throw unauthorized();
  return user;
}
