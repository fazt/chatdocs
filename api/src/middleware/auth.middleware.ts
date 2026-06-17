import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { verifyToken, type AuthPayload } from "../lib/auth.js";

export const TOKEN_COOKIE = "chatdocs_token";

export type AuthEnv = {
  Variables: {
    user?: AuthPayload;
  };
};

export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const token = getCookie(c, TOKEN_COOKIE);
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const payload = verifyToken(token);
  if (!payload) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("user", payload);
  await next();
});

export const optionalAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const token = getCookie(c, TOKEN_COOKIE);
  if (token) {
    c.set("user", verifyToken(token) ?? undefined);
  }
  await next();
});

export const requireAdmin = createMiddleware<AuthEnv>(async (c, next) => {
  const user = c.get("user");
  if (!user || user.role !== "admin") {
    return c.json({ error: "Forbidden: admin access required" }, 403);
  }
  await next();
});
