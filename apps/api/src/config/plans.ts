/**
 * Planes de Folio. El plan es del ESPACIO DE TRABAJO (equipo), no del usuario:
 * todos los miembros comparten límites. Se compran pases de 30 días (pago
 * único, sin renovación automática) con cualquiera de las pasarelas activas.
 */
export const PLAN_IDS = ["free", "pro", "team"] as const;
export type PlanId = (typeof PLAN_IDS)[number];
export const PAID_PLAN_IDS = ["pro", "team"] as const;
export type PaidPlanId = (typeof PAID_PLAN_IDS)[number];

export interface PlanLimits {
  members: number;
  documents: number;
  /** Páginas indexadas por mes (PDF = páginas reales; DOCX/MD/TXT = secciones). */
  pagesPerMonth: number;
  questionsPerMonth: number;
  extractionsPerMonth: number;
}

export interface PlanInfo {
  id: PlanId;
  name: string;
  description: string;
  priceCents: number;
  currency: "USD";
  days: number;
  limits: PlanLimits;
  features: string[];
}

export const PLANS: Record<PlanId, PlanInfo> = {
  free: {
    id: "free",
    name: "Gratis",
    description: "Para probar Folio con tus propios documentos.",
    priceCents: 0,
    currency: "USD",
    days: 0,
    limits: { members: 1, documents: 25, pagesPerMonth: 500, questionsPerMonth: 100, extractionsPerMonth: 3 },
    features: ["1 persona", "25 documentos", "500 páginas al mes", "100 preguntas al mes", "Citas verificadas por página"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "Para profesionales independientes e investigadores.",
    priceCents: 1900,
    currency: "USD",
    days: 30,
    limits: { members: 3, documents: 500, pagesPerMonth: 10_000, questionsPerMonth: 2_000, extractionsPerMonth: 50 },
    features: ["Hasta 3 personas", "500 documentos", "10 000 páginas al mes", "2 000 preguntas al mes", "Extracción de cláusulas y exportación"],
  },
  team: {
    id: "team",
    name: "Equipo",
    description: "Para estudios jurídicos, áreas de cumplimiento y grupos de investigación.",
    priceCents: 5900,
    currency: "USD",
    days: 30,
    limits: { members: 15, documents: 5_000, pagesPerMonth: 60_000, questionsPerMonth: 15_000, extractionsPerMonth: 500 },
    features: ["Hasta 15 personas con roles", "5 000 documentos", "60 000 páginas al mes", "15 000 preguntas al mes", "Bitácora de auditoría"],
  },
};

/** Plan vigente: un plan pagado caducado vuelve a Gratis. */
export function effectivePlan(plan: PlanId, expiresAt: Date | null): PlanId {
  if (plan === "free") return "free";
  return expiresAt && expiresAt.getTime() > Date.now() ? plan : "free";
}

/** Periodo de uso mensual en UTC: "2026-10". */
export function currentPeriod(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
