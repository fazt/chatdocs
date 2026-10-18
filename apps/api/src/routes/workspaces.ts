import { Hono } from "hono";
import { and, count, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { PLANS, type PlanId } from "../config/plans.js";
import { db, schema, type Tx } from "../db/client.js";
import { audit } from "../lib/audit.js";
import { randomToken, sha256 } from "../lib/crypto.js";
import { badRequest, conflict, forbidden, notFound, planLimit, tooManyRequests } from "../lib/errors.js";
import { emails, sendMailInBackground } from "../lib/mailer.js";
import { limiters } from "../lib/rate-limit.js";
import { usageSummary } from "../lib/usage.js";
import { currentUser } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { currentWorkspace, requireRole, workspaceMember } from "../middleware/workspace.js";
import type { AppEnv } from "../types.js";

const DAY = 24 * 60 * 60 * 1000;
const role = z.enum(["owner", "editor", "viewer"]);
const nameSchema = z.object({ name: z.string().trim().min(2, "Mínimo 2 caracteres").max(80) });
const inviteSchema = z.object({ email: z.email().max(254).transform((v) => v.trim().toLowerCase()), role });
const roleSchema = z.object({ role });
const userParam = z.object({ workspaceId: z.uuid(), userId: z.uuid() });
const invitationParam = z.object({ workspaceId: z.uuid(), invitationId: z.uuid() });
const auditQuery = z.object({
  before: z.iso.datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/** Bloquea el espacio y comprueba el cupo de miembros (miembros + invitaciones vigentes). */
async function assertMemberSlot(tx: Tx, workspaceId: string, plan: PlanId) {
  await tx.execute(sql`SELECT id FROM workspaces WHERE id = ${workspaceId} FOR UPDATE`);
  const [members] = await tx.select({ n: count() }).from(schema.workspaceMembers).where(eq(schema.workspaceMembers.workspaceId, workspaceId));
  const [pending] = await tx
    .select({ n: count() })
    .from(schema.invitations)
    .where(
      and(
        eq(schema.invitations.workspaceId, workspaceId),
        isNull(schema.invitations.acceptedAt),
        isNull(schema.invitations.revokedAt),
        gt(schema.invitations.expiresAt, new Date()),
      ),
    );
  if ((members?.n ?? 0) + (pending?.n ?? 0) >= PLANS[plan].limits.members) {
    throw planLimit(`Tu plan permite hasta ${PLANS[plan].limits.members} persona(s) en el espacio. Mejora el plan para invitar a más.`);
  }
}

/** Rutas de un espacio concreto: /api/workspaces/:workspaceId/... */
export const workspaceRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const workspace = currentWorkspace(c);
    return c.json({
      workspace: { id: workspace.id, name: workspace.name, plan: workspace.plan, planExpiresAt: workspace.planExpiresAt, role: workspace.role },
      usage: await usageSummary(workspace.id, workspace.plan),
      planInfo: PLANS[workspace.plan],
    });
  })

  .patch("/", requireRole("owner"), validate("json", nameSchema), async (c) => {
    const workspace = currentWorkspace(c);
    const { name } = c.req.valid("json");
    await db.update(schema.workspaces).set({ name, updatedAt: new Date() }).where(eq(schema.workspaces.id, workspace.id));
    await audit(c, workspace.id, "workspace.renamed", { type: "workspace", id: workspace.id }, { name });
    return c.json({ ok: true, name });
  })

  // --- Miembros --------------------------------------------------------------
  .get("/members", async (c) => {
    const workspace = currentWorkspace(c);
    const members = await db
      .select({
        userId: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        role: schema.workspaceMembers.role,
        joinedAt: schema.workspaceMembers.createdAt,
      })
      .from(schema.workspaceMembers)
      .innerJoin(schema.users, eq(schema.users.id, schema.workspaceMembers.userId))
      .where(eq(schema.workspaceMembers.workspaceId, workspace.id))
      .orderBy(schema.workspaceMembers.createdAt);
    const invitations =
      workspace.role === "owner"
        ? await db
            .select({
              id: schema.invitations.id,
              email: schema.invitations.email,
              role: schema.invitations.role,
              expiresAt: schema.invitations.expiresAt,
              createdAt: schema.invitations.createdAt,
            })
            .from(schema.invitations)
            .where(
              and(
                eq(schema.invitations.workspaceId, workspace.id),
                isNull(schema.invitations.acceptedAt),
                isNull(schema.invitations.revokedAt),
                gt(schema.invitations.expiresAt, new Date()),
              ),
            )
            .orderBy(desc(schema.invitations.createdAt))
        : [];
    return c.json({ members, invitations, limit: PLANS[workspace.plan].limits.members });
  })

  .post("/invitations", requireRole("owner"), validate("json", inviteSchema), async (c) => {
    const user = currentUser(c);
    const workspace = currentWorkspace(c);
    if (!limiters.invitations.consume(user.id)) throw tooManyRequests("Demasiadas invitaciones en poco tiempo");
    const body = c.req.valid("json");

    const [already] = await db
      .select({ userId: schema.users.id })
      .from(schema.workspaceMembers)
      .innerJoin(schema.users, eq(schema.users.id, schema.workspaceMembers.userId))
      .where(and(eq(schema.workspaceMembers.workspaceId, workspace.id), eq(schema.users.email, body.email)));
    if (already) throw conflict("Esa persona ya es miembro del espacio");

    const token = randomToken();
    const invitation = await db.transaction(async (tx) => {
      // Una invitación vigente por email: la nueva reemplaza a la anterior.
      await tx
        .update(schema.invitations)
        .set({ revokedAt: new Date() })
        .where(and(eq(schema.invitations.workspaceId, workspace.id), eq(schema.invitations.email, body.email), isNull(schema.invitations.acceptedAt), isNull(schema.invitations.revokedAt)));
      await assertMemberSlot(tx, workspace.id, workspace.plan);
      const [row] = await tx
        .insert(schema.invitations)
        .values({ workspaceId: workspace.id, email: body.email, role: body.role, tokenHash: sha256(token), invitedById: user.id, expiresAt: new Date(Date.now() + 7 * DAY) })
        .returning();
      return row!;
    });
    // El enlace va SOLO por email al invitado; la API nunca devuelve el token.
    sendMailInBackground(emails.invitation(body.email, workspace.name, user.name, body.role, token));
    await audit(c, workspace.id, "member.invited", { type: "invitation", id: invitation.id }, { email: body.email, role: body.role });
    return c.json({ invitation: { id: invitation.id, email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt } }, 201);
  })

  .delete("/invitations/:invitationId", requireRole("owner"), validate("param", invitationParam), async (c) => {
    const workspace = currentWorkspace(c);
    const { invitationId } = c.req.valid("param");
    const revoked = await db
      .update(schema.invitations)
      .set({ revokedAt: new Date() })
      .where(and(eq(schema.invitations.id, invitationId), eq(schema.invitations.workspaceId, workspace.id), isNull(schema.invitations.acceptedAt)))
      .returning();
    if (revoked.length === 0) throw notFound("Invitación no encontrada");
    await audit(c, workspace.id, "invitation.revoked", { type: "invitation", id: invitationId });
    return c.json({ ok: true });
  })

  .patch("/members/:userId", requireRole("owner"), validate("param", userParam), validate("json", roleSchema), async (c) => {
    const workspace = currentWorkspace(c);
    const { userId } = c.req.valid("param");
    const { role: newRole } = c.req.valid("json");
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM workspaces WHERE id = ${workspace.id} FOR UPDATE`);
      const [member] = await tx
        .select()
        .from(schema.workspaceMembers)
        .where(and(eq(schema.workspaceMembers.workspaceId, workspace.id), eq(schema.workspaceMembers.userId, userId)));
      if (!member) throw notFound("Miembro no encontrado");
      if (member.role === "owner" && newRole !== "owner") {
        const [owners] = await tx
          .select({ n: count() })
          .from(schema.workspaceMembers)
          .where(and(eq(schema.workspaceMembers.workspaceId, workspace.id), eq(schema.workspaceMembers.role, "owner")));
        if ((owners?.n ?? 0) <= 1) throw badRequest("El espacio necesita al menos una persona propietaria");
      }
      await tx
        .update(schema.workspaceMembers)
        .set({ role: newRole })
        .where(and(eq(schema.workspaceMembers.workspaceId, workspace.id), eq(schema.workspaceMembers.userId, userId)));
    });
    await audit(c, workspace.id, "member.role_changed", { type: "user", id: userId }, { role: newRole });
    return c.json({ ok: true });
  })

  .delete("/members/:userId", validate("param", userParam), async (c) => {
    const user = currentUser(c);
    const workspace = currentWorkspace(c);
    const { userId } = c.req.valid("param");
    // Cualquiera puede salir del espacio; solo la persona propietaria puede quitar a otros.
    if (userId !== user.id && workspace.role !== "owner") throw forbidden("Solo la persona propietaria puede quitar miembros");
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM workspaces WHERE id = ${workspace.id} FOR UPDATE`);
      const [member] = await tx
        .select()
        .from(schema.workspaceMembers)
        .where(and(eq(schema.workspaceMembers.workspaceId, workspace.id), eq(schema.workspaceMembers.userId, userId)));
      if (!member) throw notFound("Miembro no encontrado");
      if (member.role === "owner") {
        const [owners] = await tx
          .select({ n: count() })
          .from(schema.workspaceMembers)
          .where(and(eq(schema.workspaceMembers.workspaceId, workspace.id), eq(schema.workspaceMembers.role, "owner")));
        if ((owners?.n ?? 0) <= 1) throw badRequest("No puedes quitar a la única persona propietaria");
      }
      await tx.delete(schema.workspaceMembers).where(and(eq(schema.workspaceMembers.workspaceId, workspace.id), eq(schema.workspaceMembers.userId, userId)));
    });
    await audit(c, workspace.id, "member.removed", { type: "user", id: userId });
    return c.json({ ok: true });
  })

  // --- Bitácora -------------------------------------------------------------------
  .get("/audit", requireRole("editor"), validate("query", auditQuery), async (c) => {
    const workspace = currentWorkspace(c);
    const { before, limit } = c.req.valid("query");
    const rows = await db
      .select({
        id: schema.auditLogs.id,
        action: schema.auditLogs.action,
        targetType: schema.auditLogs.targetType,
        targetId: schema.auditLogs.targetId,
        meta: schema.auditLogs.meta,
        createdAt: schema.auditLogs.createdAt,
        userName: schema.users.name,
        userEmail: schema.users.email,
      })
      .from(schema.auditLogs)
      .leftJoin(schema.users, eq(schema.users.id, schema.auditLogs.userId))
      .where(and(eq(schema.auditLogs.workspaceId, workspace.id), before ? lt(schema.auditLogs.createdAt, new Date(before)) : undefined))
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(limit + 1);
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    return c.json({ items, nextCursor: hasMore ? items.at(-1)!.createdAt.toISOString() : null });
  });

/** Rutas sin espacio concreto: crear espacio y aceptar invitación. */
export const workspaceRootRoutes = new Hono<AppEnv>()
  .post("/workspaces", validate("json", nameSchema), async (c) => {
    const user = currentUser(c);
    const { name } = c.req.valid("json");
    const [owned] = await db
      .select({ n: count() })
      .from(schema.workspaceMembers)
      .where(and(eq(schema.workspaceMembers.userId, user.id), eq(schema.workspaceMembers.role, "owner")));
    if ((owned?.n ?? 0) >= 10) throw badRequest("Puedes ser propietario de hasta 10 espacios");
    const workspace = await db.transaction(async (tx) => {
      const [row] = await tx.insert(schema.workspaces).values({ name, createdById: user.id }).returning();
      await tx.insert(schema.workspaceMembers).values({ workspaceId: row!.id, userId: user.id, role: "owner" });
      await tx.insert(schema.collections).values({ workspaceId: row!.id, name: "General", kind: "general", createdById: user.id });
      return row!;
    });
    await audit(c, workspace.id, "workspace.created", { type: "workspace", id: workspace.id }, { name });
    return c.json({ workspace: { id: workspace.id, name: workspace.name, plan: workspace.plan, role: "owner" } }, 201);
  })

  .post("/invitations/accept", validate("json", z.object({ token: z.string().min(20).max(200) })), async (c) => {
    const user = currentUser(c);
    const { token } = c.req.valid("json");
    const [invitation] = await db
      .select()
      .from(schema.invitations)
      .where(and(eq(schema.invitations.tokenHash, sha256(token)), isNull(schema.invitations.acceptedAt), isNull(schema.invitations.revokedAt), gt(schema.invitations.expiresAt, new Date())));
    if (!invitation) throw badRequest("La invitación no es válida, ya se usó o caducó", "INVALID_TOKEN");
    // La invitación es para un email concreto: no sirve con otra cuenta.
    if (invitation.email !== user.email) throw forbidden(`Esta invitación es para ${invitation.email}. Inicia sesión con esa cuenta.`);

    await db.transaction(async (tx) => {
      const used = await tx
        .update(schema.invitations)
        .set({ acceptedAt: new Date() })
        .where(and(eq(schema.invitations.id, invitation.id), isNull(schema.invitations.acceptedAt), isNull(schema.invitations.revokedAt)))
        .returning();
      if (used.length === 0) throw badRequest("La invitación ya se usó", "INVALID_TOKEN");
      await tx.insert(schema.workspaceMembers).values({ workspaceId: invitation.workspaceId, userId: user.id, role: invitation.role }).onConflictDoNothing();
    });
    await audit(c, invitation.workspaceId, "member.joined", { type: "user", id: user.id }, { role: invitation.role });
    return c.json({ ok: true, workspaceId: invitation.workspaceId });
  });

export { workspaceMember };
