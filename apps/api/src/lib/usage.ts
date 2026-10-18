import { and, count, eq, sql } from "drizzle-orm";
import { PLANS, currentPeriod, type PlanId } from "../config/plans.js";
import { db, schema, type Tx } from "../db/client.js";
import { planLimit } from "./errors.js";

export type UsageMetric = "questions" | "pages" | "extractions";

const LIMIT_OF: Record<UsageMetric, (plan: PlanId) => number> = {
  questions: (plan) => PLANS[plan].limits.questionsPerMonth,
  pages: (plan) => PLANS[plan].limits.pagesPerMonth,
  extractions: (plan) => PLANS[plan].limits.extractionsPerMonth,
};

const MESSAGES: Record<UsageMetric, string> = {
  questions: "Llegaste al límite de preguntas de este mes en tu plan",
  pages: "Llegaste al límite de páginas indexadas de este mes en tu plan",
  extractions: "Llegaste al límite de extracciones de este mes en tu plan",
};

/**
 * Suma `amount` al contador del mes SOLO si no supera el límite, en una única
 * sentencia (INSERT … ON CONFLICT DO UPDATE … WHERE): dos peticiones
 * simultáneas nunca pasan las dos el último cupo. Lanza 402 si no hay cupo.
 */
export async function consumeUsage(
  workspaceId: string,
  plan: PlanId,
  metric: UsageMetric,
  amount = 1,
  client: typeof db | Tx = db,
): Promise<void> {
  const limit = LIMIT_OF[metric](plan);
  if (amount > limit) throw planLimit(MESSAGES[metric]);
  const column = sql.identifier(metric);
  const result = await client.execute(sql`
    INSERT INTO usage_counters (workspace_id, period, ${column})
    VALUES (${workspaceId}, ${currentPeriod()}, ${amount})
    ON CONFLICT (workspace_id, period)
    DO UPDATE SET ${column} = usage_counters.${column} + ${amount}
    WHERE usage_counters.${column} + ${amount} <= ${limit}
    RETURNING ${column} AS value
  `);
  if (result.rows.length === 0) throw planLimit(MESSAGES[metric]);
}

/** Devuelve cupo consumido (p. ej. una pregunta que falló antes de llegar al modelo). */
export async function refundUsage(workspaceId: string, metric: UsageMetric, amount = 1): Promise<void> {
  const column = sql.identifier(metric);
  await db.execute(sql`
    UPDATE usage_counters SET ${column} = GREATEST(${column} - ${amount}, 0)
    WHERE workspace_id = ${workspaceId} AND period = ${currentPeriod()}
  `);
}

export async function usageSummary(workspaceId: string, plan: PlanId) {
  const [counter] = await db
    .select()
    .from(schema.usageCounters)
    .where(and(eq(schema.usageCounters.workspaceId, workspaceId), eq(schema.usageCounters.period, currentPeriod())));
  const [docs] = await db.select({ n: count() }).from(schema.documents).where(eq(schema.documents.workspaceId, workspaceId));
  const [members] = await db
    .select({ n: count() })
    .from(schema.workspaceMembers)
    .where(eq(schema.workspaceMembers.workspaceId, workspaceId));
  const limits = PLANS[plan].limits;
  return {
    period: currentPeriod(),
    plan,
    limits,
    used: {
      questions: counter?.questions ?? 0,
      pages: counter?.pages ?? 0,
      extractions: counter?.extractions ?? 0,
      documents: docs?.n ?? 0,
      members: members?.n ?? 0,
    },
  };
}
