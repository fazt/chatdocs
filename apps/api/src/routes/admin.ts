import { Hono } from "hono";
import { and, count, desc, eq, gte, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { providerInfo } from "../ai/index.js";
import { refundPayment } from "../billing/service.js";
import { currentPeriod } from "../config/plans.js";
import { db, schema } from "../db/client.js";
import { badRequest, notFound } from "../lib/errors.js";
import { currentUser } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import type { AppEnv } from "../types.js";

const pageQuery = z.object({
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
const idParam = z.object({ id: z.uuid() });
const userPatch = z.object({ role: z.enum(["user", "admin"]).optional(), disabled: z.boolean().optional() });

const like = (q: string) => `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;

export const adminRoutes = new Hono<AppEnv>()
  .get("/stats", async (c) => {
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [[users], [workspaces], [documents], [paid], usage, revenue, byStatus] = await Promise.all([
      db.select({ n: count() }).from(schema.users),
      db.select({ n: count() }).from(schema.workspaces),
      db.select({ n: count(), pages: sql<number>`coalesce(sum(${schema.documents.pageCount}), 0)::int` }).from(schema.documents),
      db.select({ n: count() }).from(schema.workspaces).where(and(sql`${schema.workspaces.plan} <> 'free'`, gte(schema.workspaces.planExpiresAt, new Date()))),
      db
        .select({
          questions: sql<number>`coalesce(sum(${schema.usageCounters.questions}), 0)::int`,
          pages: sql<number>`coalesce(sum(${schema.usageCounters.pages}), 0)::int`,
          extractions: sql<number>`coalesce(sum(${schema.usageCounters.extractions}), 0)::int`,
        })
        .from(schema.usageCounters)
        .where(eq(schema.usageCounters.period, currentPeriod())),
      // Ingresos por moneda: nunca se suman monedas distintas.
      db
        .select({ currency: schema.payments.chargeCurrency, cents: sql<number>`sum(${schema.payments.chargeCents})::int`, n: count() })
        .from(schema.payments)
        .where(and(eq(schema.payments.status, "paid"), gte(schema.payments.paidAt, since30)))
        .groupBy(schema.payments.chargeCurrency),
      db.select({ status: schema.documents.status, n: count() }).from(schema.documents).groupBy(schema.documents.status),
    ]);
    return c.json({
      users: users?.n ?? 0,
      workspaces: workspaces?.n ?? 0,
      paidWorkspaces: paid?.n ?? 0,
      documents: documents?.n ?? 0,
      pagesIndexed: documents?.pages ?? 0,
      documentsByStatus: byStatus,
      usageThisMonth: usage[0] ?? { questions: 0, pages: 0, extractions: 0 },
      revenue30d: revenue,
      ai: providerInfo(),
    });
  })

  .get("/users", validate("query", pageQuery), async (c) => {
    const { q, page, pageSize } = c.req.valid("query");
    const where = q ? or(ilike(schema.users.email, like(q)), ilike(schema.users.name, like(q))) : undefined;
    const [rows, [total]] = await Promise.all([
      db
        .select({
          id: schema.users.id,
          email: schema.users.email,
          name: schema.users.name,
          role: schema.users.role,
          disabledAt: schema.users.disabledAt,
          createdAt: schema.users.createdAt,
          workspaces: sql<number>`(SELECT count(*)::int FROM workspace_members m WHERE m.user_id = ${schema.users.id})`,
        })
        .from(schema.users)
        .where(where)
        .orderBy(desc(schema.users.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ n: count() }).from(schema.users).where(where),
    ]);
    return c.json({ users: rows, total: total?.n ?? 0, page, pageSize });
  })

  .patch("/users/:id", validate("param", idParam), validate("json", userPatch), async (c) => {
    const me = currentUser(c);
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    if (id === me.id && (body.role === "user" || body.disabled)) throw badRequest("No puedes quitarte el rol de administrador ni desactivarte");
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    if (!user) throw notFound("Usuario no encontrado");
    const [updated] = await db
      .update(schema.users)
      .set({
        ...(body.role ? { role: body.role } : {}),
        ...(body.disabled !== undefined ? { disabledAt: body.disabled ? new Date() : null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, id))
      .returning();
    // Desactivar corta el acceso al instante: se borran sus sesiones.
    if (body.disabled) await db.delete(schema.sessions).where(eq(schema.sessions.userId, id));
    return c.json({ user: { id: updated!.id, email: updated!.email, name: updated!.name, role: updated!.role, disabledAt: updated!.disabledAt } });
  })

  .get("/workspaces", validate("query", pageQuery), async (c) => {
    const { q, page, pageSize } = c.req.valid("query");
    const where = q ? ilike(schema.workspaces.name, like(q)) : undefined;
    const [rows, [total]] = await Promise.all([
      db
        .select({
          id: schema.workspaces.id,
          name: schema.workspaces.name,
          plan: schema.workspaces.plan,
          planExpiresAt: schema.workspaces.planExpiresAt,
          createdAt: schema.workspaces.createdAt,
          members: sql<number>`(SELECT count(*)::int FROM workspace_members m WHERE m.workspace_id = ${schema.workspaces.id})`,
          documents: sql<number>`(SELECT count(*)::int FROM documents d WHERE d.workspace_id = ${schema.workspaces.id})`,
        })
        .from(schema.workspaces)
        .where(where)
        .orderBy(desc(schema.workspaces.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ n: count() }).from(schema.workspaces).where(where),
    ]);
    return c.json({ workspaces: rows, total: total?.n ?? 0, page, pageSize });
  })

  .get("/payments", validate("query", pageQuery), async (c) => {
    const { page, pageSize } = c.req.valid("query");
    const [rows, [total]] = await Promise.all([
      db
        .select({
          id: schema.payments.id,
          workspaceName: schema.workspaces.name,
          provider: schema.payments.provider,
          plan: schema.payments.plan,
          status: schema.payments.status,
          chargeCents: schema.payments.chargeCents,
          chargeCurrency: schema.payments.chargeCurrency,
          createdAt: schema.payments.createdAt,
          paidAt: schema.payments.paidAt,
        })
        .from(schema.payments)
        .innerJoin(schema.workspaces, eq(schema.workspaces.id, schema.payments.workspaceId))
        .orderBy(desc(schema.payments.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ n: count() }).from(schema.payments),
    ]);
    return c.json({ payments: rows, total: total?.n ?? 0, page, pageSize });
  })

  .post("/payments/:id/refund", validate("param", idParam), async (c) => {
    const payment = await refundPayment(c.req.valid("param").id);
    return c.json({ payment: { id: payment.id, status: payment.status, refundedAt: payment.refundedAt } });
  });
