import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { and, eq, gt, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../db/client.js";
import { randomToken, sha256 } from "../lib/crypto.js";
import { badRequest, conflict, tooManyRequests, unauthorized } from "../lib/errors.js";
import { emails, sendMailInBackground } from "../lib/mailer.js";
import { burnPasswordCheck, hashPassword, verifyPassword } from "../lib/password.js";
import { limiters } from "../lib/rate-limit.js";
import { clientIp } from "../lib/request.js";
import { clearSessionCookie, createSession, currentUser, requireAuth, SESSION_COOKIE } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import type { AppEnv } from "../types.js";

const email = z.email("Email inválido").max(254).transform((v) => v.trim().toLowerCase());
const password = z
  .string()
  .min(10, "La contraseña debe tener al menos 10 caracteres")
  .max(200)
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), "Usa letras y al menos un número");

const registerSchema = z.object({ email, password, name: z.string().trim().min(1, "Escribe tu nombre").max(80) });
const loginSchema = z.object({ email, password: z.string().min(1).max(200) });
const forgotSchema = z.object({ email });
const resetSchema = z.object({ token: z.string().min(20).max(200), password });
const updateMeSchema = z.object({ name: z.string().trim().min(1).max(80) });
const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(200), newPassword: password });
const deleteMeSchema = z.object({ password: z.string().min(1).max(200) });

const HOUR = 60 * 60 * 1000;

const publicUser = (u: { id: string; email: string; name: string; role: string }) => ({ id: u.id, email: u.email, name: u.name, role: u.role });

/** Al registrarse: espacio personal (propietario) con un primer expediente. */
async function createPersonalWorkspace(userId: string, name: string) {
  return db.transaction(async (tx) => {
    const [workspace] = await tx
      .insert(schema.workspaces)
      .values({ name: `Espacio de ${name.split(" ")[0]}`, createdById: userId })
      .returning();
    await tx.insert(schema.workspaceMembers).values({ workspaceId: workspace!.id, userId, role: "owner" });
    await tx.insert(schema.collections).values({
      workspaceId: workspace!.id,
      name: "Mis documentos",
      description: "Primer expediente. Crea otros por caso, cliente o proyecto de investigación.",
      kind: "general",
      createdById: userId,
    });
    return workspace!;
  });
}

export const authRoutes = new Hono<AppEnv>()
  .post("/register", validate("json", registerSchema), async (c) => {
    // Cuenta TODAS las peticiones (responde 2xx): evita creación masiva de cuentas.
    if (!limiters.register.consume(clientIp(c))) throw tooManyRequests("Demasiados registros desde tu red, prueba más tarde");
    const body = c.req.valid("json");
    const [existing] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, body.email));
    if (existing) throw conflict("Ya existe una cuenta con ese email. Inicia sesión o recupera tu contraseña.", "EMAIL_TAKEN");

    const [user] = await db
      .insert(schema.users)
      .values({ email: body.email, name: body.name, passwordHash: await hashPassword(body.password) })
      .onConflictDoNothing()
      .returning();
    if (!user) throw conflict("Ya existe una cuenta con ese email", "EMAIL_TAKEN");
    const workspace = await createPersonalWorkspace(user.id, user.name);
    await createSession(c, user.id);
    sendMailInBackground(emails.welcome(user.email, user.name));
    return c.json({ user: publicUser(user), workspaceId: workspace.id }, 201);
  })

  .post("/login", validate("json", loginSchema), async (c) => {
    const body = c.req.valid("json");
    const ip = clientIp(c);
    // Solo cuentan los intentos FALLIDOS: quien acierta no se bloquea.
    if (limiters.loginFailuresByIp.isBlocked(ip) || limiters.loginFailuresByEmail.isBlocked(body.email)) {
      throw tooManyRequests("Demasiados intentos fallidos. Espera unos minutos.");
    }
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, body.email));
    const valid = user && !user.disabledAt ? await verifyPassword(body.password, user.passwordHash) : await burnPasswordCheck(body.password);
    if (!user || !valid || user.disabledAt) {
      limiters.loginFailuresByIp.consume(ip);
      limiters.loginFailuresByEmail.consume(body.email);
      throw unauthorized("Email o contraseña incorrectos");
    }
    limiters.loginFailuresByEmail.reset(body.email);
    await createSession(c, user.id);
    return c.json({ user: publicUser(user) });
  })

  .post("/logout", async (c) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (token) await db.delete(schema.sessions).where(eq(schema.sessions.tokenHash, sha256(token)));
    clearSessionCookie(c);
    return c.json({ ok: true });
  })

  .get("/me", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ user: null, workspaces: [] });
    const workspaces = await db
      .select({ id: schema.workspaces.id, name: schema.workspaces.name, plan: schema.workspaces.plan, role: schema.workspaceMembers.role })
      .from(schema.workspaceMembers)
      .innerJoin(schema.workspaces, eq(schema.workspaces.id, schema.workspaceMembers.workspaceId))
      .where(eq(schema.workspaceMembers.userId, user.id))
      .orderBy(schema.workspaces.createdAt);
    return c.json({ user: publicUser(user), workspaces });
  })

  .post("/forgot-password", validate("json", forgotSchema), async (c) => {
    const { email: address } = c.req.valid("json");
    // Responde siempre lo mismo (sin enumeración) y cuenta TODAS las peticiones.
    const generic = { ok: true, message: "Si el email tiene una cuenta, te enviamos un enlace para restablecer la contraseña." };
    if (!limiters.forgotByIp.consume(clientIp(c)) || !limiters.forgotByEmail.consume(address)) return c.json(generic, 202);

    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, address));
    if (user && !user.disabledAt) {
      const token = randomToken();
      await db.insert(schema.passwordResets).values({ userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + HOUR) });
      sendMailInBackground(emails.passwordReset(user.email, token));
    }
    return c.json(generic, 202);
  })

  .post("/reset-password", validate("json", resetSchema), async (c) => {
    if (!limiters.resetPassword.consume(clientIp(c))) throw tooManyRequests();
    const body = c.req.valid("json");
    // Un solo uso: se marca como usado en la misma sentencia que lo valida.
    const [reset] = await db
      .update(schema.passwordResets)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(schema.passwordResets.tokenHash, sha256(body.token)),
          isNull(schema.passwordResets.usedAt),
          gt(schema.passwordResets.expiresAt, new Date()),
        ),
      )
      .returning();
    if (!reset) throw badRequest("El enlace no es válido o ya caducó. Pide uno nuevo.", "INVALID_TOKEN");
    await db
      .update(schema.users)
      .set({ passwordHash: await hashPassword(body.password), updatedAt: new Date() })
      .where(eq(schema.users.id, reset.userId));
    // Cierra todas las sesiones abiertas (por si alguien más tenía acceso).
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, reset.userId));
    return c.json({ ok: true });
  })

  .patch("/me", requireAuth, validate("json", updateMeSchema), async (c) => {
    const user = currentUser(c);
    const [updated] = await db
      .update(schema.users)
      .set({ name: c.req.valid("json").name, updatedAt: new Date() })
      .where(eq(schema.users.id, user.id))
      .returning();
    return c.json({ user: publicUser(updated!) });
  })

  .post("/change-password", requireAuth, validate("json", changePasswordSchema), async (c) => {
    const user = currentUser(c);
    const body = c.req.valid("json");
    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, user.id));
    if (!row || !(await verifyPassword(body.currentPassword, row.passwordHash))) throw badRequest("La contraseña actual no es correcta", "WRONG_PASSWORD");
    await db.update(schema.users).set({ passwordHash: await hashPassword(body.newPassword), updatedAt: new Date() }).where(eq(schema.users.id, user.id));
    // Mantiene la sesión actual y cierra las demás.
    await db.delete(schema.sessions).where(and(eq(schema.sessions.userId, user.id), ne(schema.sessions.id, user.sessionId)));
    return c.json({ ok: true });
  })

  .delete("/me", requireAuth, validate("json", deleteMeSchema), async (c) => {
    const user = currentUser(c);
    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, user.id));
    if (!row || !(await verifyPassword(c.req.valid("json").password, row.passwordHash))) throw badRequest("La contraseña no es correcta", "WRONG_PASSWORD");
    // Espacios donde es la única persona propietaria: se borran con todo su contenido.
    const owned = await db
      .select({ workspaceId: schema.workspaceMembers.workspaceId })
      .from(schema.workspaceMembers)
      .where(and(eq(schema.workspaceMembers.userId, user.id), eq(schema.workspaceMembers.role, "owner")));
    await db.transaction(async (tx) => {
      for (const { workspaceId } of owned) {
        const others = await tx
          .select({ userId: schema.workspaceMembers.userId })
          .from(schema.workspaceMembers)
          .where(and(eq(schema.workspaceMembers.workspaceId, workspaceId), eq(schema.workspaceMembers.role, "owner"), ne(schema.workspaceMembers.userId, user.id)));
        if (others.length === 0) await tx.delete(schema.workspaces).where(eq(schema.workspaces.id, workspaceId));
      }
      await tx.delete(schema.users).where(eq(schema.users.id, user.id));
    });
    clearSessionCookie(c);
    return c.json({ ok: true });
  });
