import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { db, schema } from "../db/index.js";
import { hashPassword, verifyPassword, signToken, setAuthCookie, removeAuthCookie, TOKEN_COOKIE } from "../lib/auth.js";
import { uuid, now, first } from "../lib/utils.js";
import { optionalAuth, type AuthEnv } from "../middleware/auth.middleware.js";
import { sendWelcomeEmail } from "../lib/email.js";
import { eq } from "drizzle-orm";
import { validate } from "../middleware/validate.js";
import { registerSchema, loginSchema } from "../schemas/auth.schema.js";

const routes = new Hono<AuthEnv>();

routes.post("/register", validate(registerSchema), async (c) => {
  const { email, password, name } = c.req.valid("json");

  const existing = first(
    await db.select().from(schema.users).where(eq(schema.users.email, email))
  );

  if (existing) {
    return c.json({ error: "Email already registered" }, 409);
  }

  const id = uuid();
  const hashedPassword = await hashPassword(password);
  const role = "user";
  const displayName = name || email.split("@")[0];

  await db.insert(schema.users).values({
    id,
    email,
    hashedPassword,
    name: displayName,
    role,
    createdAt: now(),
  });

  const token = signToken({ userId: id, email, role });
  c.header("Set-Cookie", setAuthCookie(token));

  sendWelcomeEmail(email, displayName).catch((err) =>
    console.error("[Welcome Email Error]", err)
  );

  return c.json({ user: { id, email, role, name: displayName } }, 201);
});

routes.post("/login", validate(loginSchema), async (c) => {
  const { email, password } = c.req.valid("json");

  const user = first(
    await db.select().from(schema.users).where(eq(schema.users.email, email))
  );

  if (!user) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  const valid = await verifyPassword(password, user.hashedPassword);
  if (!valid) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  c.header("Set-Cookie", setAuthCookie(token));

  return c.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

routes.post("/logout", (c) => {
  deleteCookie(c, TOKEN_COOKIE, { path: "/" });
  return c.json({ success: true });
});

routes.get("/me", optionalAuth, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ user: null });
  }

  const found = first(
    await db
      .select({ id: schema.users.id, email: schema.users.email, name: schema.users.name })
      .from(schema.users)
      .where(eq(schema.users.id, user.userId))
  );

  if (!found) {
    deleteCookie(c, TOKEN_COOKIE, { path: "/" });
    return c.json({ user: null });
  }

  return c.json({ user: found });
});

export default routes;
