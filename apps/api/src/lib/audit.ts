import type { Context } from "hono";
import { db, schema } from "../db/client.js";
import type { AppEnv } from "../types.js";
import { logger } from "./logger.js";
import { clientIp } from "./request.js";

/**
 * Bitácora de auditoría por espacio de trabajo (quién subió, borró, exportó o
 * consultó qué y cuándo). Pensada para cumplimiento: nunca guarda el contenido
 * de las preguntas ni de los documentos, solo la acción y el objeto.
 */
export type AuditAction =
  | "workspace.created"
  | "workspace.renamed"
  | "member.invited"
  | "member.joined"
  | "member.role_changed"
  | "member.removed"
  | "invitation.revoked"
  | "collection.created"
  | "collection.updated"
  | "collection.deleted"
  | "document.uploaded"
  | "document.updated"
  | "document.deleted"
  | "document.downloaded"
  | "document.reindexed"
  | "conversation.created"
  | "conversation.deleted"
  | "conversation.exported"
  | "extraction.created"
  | "extraction.exported"
  | "extraction.deleted"
  | "billing.checkout_started"
  | "billing.plan_activated"
  | "billing.refunded";

export async function audit(
  c: Context<AppEnv> | null,
  workspaceId: string,
  action: AuditAction,
  target?: { type: string; id: string },
  meta: Record<string, unknown> = {},
  userIdOverride?: string | null,
): Promise<void> {
  try {
    await db.insert(schema.auditLogs).values({
      workspaceId,
      userId: userIdOverride !== undefined ? userIdOverride : (c?.get("user")?.id ?? null),
      action,
      targetType: target?.type ?? null,
      targetId: target?.id ?? null,
      meta,
      ip: c ? clientIp(c) : null,
    });
  } catch (error) {
    // La auditoría no debe tumbar la acción principal, pero sí quedar registrada.
    logger.error({ err: error, action, workspaceId }, "no se pudo registrar la auditoría");
  }
}
