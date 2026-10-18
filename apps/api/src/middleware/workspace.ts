import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { and, eq } from "drizzle-orm";
import { effectivePlan } from "../config/plans.js";
import { db, schema } from "../db/client.js";
import type { MemberRole } from "../db/schema.js";
import { forbidden, notFound, unauthorized } from "../lib/errors.js";
import type { AppEnv, WorkspaceContext } from "../types.js";

const RANK: Record<MemberRole, number> = { viewer: 1, editor: 2, owner: 3 };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const hasRole = (role: MemberRole, min: MemberRole): boolean => RANK[role] >= RANK[min];

/**
 * Carga el espacio de `:workspaceId` y exige que el usuario sea miembro. Un
 * espacio ajeno responde 404 (no 403) para no revelar que existe.
 */
export const workspaceMember = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get("user");
  if (!user) throw unauthorized();
  const workspaceId = c.req.param("workspaceId");
  if (!workspaceId || !UUID.test(workspaceId)) throw notFound("Espacio de trabajo no encontrado");

  const [row] = await db
    .select({
      id: schema.workspaces.id,
      name: schema.workspaces.name,
      plan: schema.workspaces.plan,
      planExpiresAt: schema.workspaces.planExpiresAt,
      role: schema.workspaceMembers.role,
    })
    .from(schema.workspaceMembers)
    .innerJoin(schema.workspaces, eq(schema.workspaces.id, schema.workspaceMembers.workspaceId))
    .where(and(eq(schema.workspaceMembers.workspaceId, workspaceId), eq(schema.workspaceMembers.userId, user.id)))
    .limit(1);
  if (!row) throw notFound("Espacio de trabajo no encontrado");

  c.set("workspace", { ...row, plan: effectivePlan(row.plan, row.planExpiresAt) });
  await next();
});

/** Exige un rol mínimo dentro del espacio (va después de workspaceMember). */
export const requireRole = (min: MemberRole) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const workspace = c.get("workspace");
    if (!workspace) throw notFound("Espacio de trabajo no encontrado");
    if (!hasRole(workspace.role, min)) {
      throw forbidden(min === "owner" ? "Solo la persona propietaria del espacio puede hacer esto" : "Tu rol es de solo lectura en este espacio");
    }
    await next();
  });

export function currentWorkspace(c: Context<AppEnv>): WorkspaceContext {
  const workspace = c.get("workspace");
  if (!workspace) throw notFound("Espacio de trabajo no encontrado");
  return workspace;
}
