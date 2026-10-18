import { and, eq, inArray, sql } from "drizzle-orm";
import { env } from "../config/env.js";
import { PLANS, type PaidPlanId } from "../config/plans.js";
import { db, schema, type Tx } from "../db/client.js";
import type { Payment } from "../db/schema.js";
import { audit } from "../lib/audit.js";
import { badRequest, notFound } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { emails, sendMailInBackground } from "../lib/mailer.js";
import { convertCents } from "../lib/money.js";
import { enabledProviders, getProvider, resolveProvider } from "./providers/index.js";
import type { PaymentEvent, PaymentProviderId } from "./providers/types.js";

const DAY = 24 * 60 * 60 * 1000;
const UUID = /^[0-9a-f-]{36}$/i;

export function listProviders() {
  return enabledProviders().map((p) => ({ id: p.id, label: p.label }));
}

/** Monto que se cobra en la pasarela: USD salvo Mercado Pago (moneda local con tipo de cambio fijo). */
function chargeFor(providerId: PaymentProviderId, usdCents: number): { cents: number; currency: string } {
  if (providerId === "mercadopago") {
    return { cents: convertCents(usdCents, env.MERCADOPAGO_FX_RATE, env.MERCADOPAGO_CURRENCY), currency: env.MERCADOPAGO_CURRENCY };
  }
  return { cents: usdCents, currency: "USD" };
}

/** Crea el pago PENDIENTE y la sesión de la pasarela. El plan SOLO se activa por webhook verificado. */
export async function startCheckout(workspaceId: string, userId: string, email: string, plan: PaidPlanId, providerId: PaymentProviderId) {
  const provider = resolveProvider(providerId);
  if (!provider) throw badRequest("Ese método de pago no está disponible");
  const info = PLANS[plan];
  const charge = chargeFor(provider.id, info.priceCents);

  const [payment] = await db
    .insert(schema.payments)
    .values({
      workspaceId,
      userId,
      provider: provider.id,
      plan,
      amountCents: info.priceCents,
      currency: info.currency,
      chargeCents: charge.cents,
      chargeCurrency: charge.currency,
      days: info.days,
    })
    .returning();
  const back = `${env.APP_URL}/app/${workspaceId}/plan`;
  const session = await provider.createCheckout({
    paymentId: payment!.id,
    reference: payment!.id.slice(0, 8).toUpperCase(),
    description: `Folio ${info.name} · ${info.days} días`,
    amountCents: charge.cents,
    currency: charge.currency,
    customerEmail: email,
    successUrl: `${back}?pago=ok`,
    cancelUrl: `${back}?pago=cancelado`,
  });
  await db.update(schema.payments).set({ providerRef: session.providerRef }).where(eq(schema.payments.id, payment!.id));
  return { paymentId: payment!.id, url: session.url };
}

async function findPayment(tx: Tx, providerId: string, event: PaymentEvent): Promise<Payment | null> {
  if (event.paymentId && UUID.test(event.paymentId)) {
    const [p] = await tx
      .select()
      .from(schema.payments)
      .where(and(eq(schema.payments.id, event.paymentId), eq(schema.payments.provider, providerId)));
    if (p) return p;
  }
  if (event.providerRef) {
    const [p] = await tx
      .select()
      .from(schema.payments)
      .where(and(eq(schema.payments.providerRef, event.providerRef), eq(schema.payments.provider, providerId)));
    if (p) return p;
  }
  if (event.captureRef) {
    const [p] = await tx
      .select()
      .from(schema.payments)
      .where(and(eq(schema.payments.captureRef, event.captureRef), eq(schema.payments.provider, providerId)));
    if (p) return p;
  }
  return null;
}

/**
 * Aplica un evento VERIFICADO. Idempotente por dos vías: `processed_webhooks`
 * (el mismo evento dos veces) y transiciones condicionadas al estado actual
 * (`UPDATE … WHERE status`): un pago nunca extiende el plan dos veces.
 */
export async function handlePaymentEvent(providerId: PaymentProviderId, event: PaymentEvent) {
  const outcome = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(schema.processedWebhooks)
      .values({ provider: providerId, eventId: event.eventId })
      .onConflictDoNothing()
      .returning();
    if (inserted.length === 0) return { status: "duplicate" as const };

    const payment = await findPayment(tx, providerId, event);
    if (!payment) {
      logger.warn({ provider: providerId, eventId: event.eventId }, "webhook de un pago desconocido");
      return { status: "ignored" as const };
    }

    if (event.type === "paid") {
      if (event.amountCents && event.amountCents !== payment.chargeCents) {
        logger.error({ paymentId: payment.id, expected: payment.chargeCents, got: event.amountCents }, "importe del webhook distinto");
        return { status: "ignored" as const };
      }
      const moved = await tx
        .update(schema.payments)
        .set({ status: "paid", paidAt: new Date(), ...(event.captureRef ? { captureRef: event.captureRef } : {}) })
        .where(and(eq(schema.payments.id, payment.id), inArray(schema.payments.status, ["pending", "failed"])))
        .returning();
      if (moved.length === 0) return { status: "duplicate" as const };

      // Bloquea la fila del espacio: dos pagos simultáneos suman bien los días.
      const locked = await tx.execute<{ plan: string; plan_expires_at: Date | null; name: string }>(
        sql`SELECT plan, plan_expires_at, name FROM workspaces WHERE id = ${payment.workspaceId} FOR UPDATE`,
      );
      const workspace = locked.rows[0];
      if (!workspace) return { status: "ignored" as const };
      const currentExpiry = workspace.plan_expires_at ? new Date(workspace.plan_expires_at) : null;
      // Mismo plan vigente: se suman los días. Plan distinto o caducado: empieza hoy.
      const active = workspace.plan === payment.plan && currentExpiry && currentExpiry > new Date();
      const from = active ? currentExpiry! : new Date();
      const expires = new Date(from.getTime() + payment.days * DAY);
      await tx
        .update(schema.workspaces)
        .set({ plan: payment.plan, planExpiresAt: expires, updatedAt: new Date() })
        .where(eq(schema.workspaces.id, payment.workspaceId));
      return { status: "processed" as const, activated: { payment, expires, workspaceName: workspace.name } };
    }
    if (event.type === "failed") {
      await tx
        .update(schema.payments)
        .set({ status: "failed" })
        .where(and(eq(schema.payments.id, payment.id), eq(schema.payments.status, "pending")));
      return { status: "processed" as const };
    }
    await revokeDays(tx, payment);
    return { status: "processed" as const };
  });

  if ("activated" in outcome && outcome.activated) {
    const { payment, expires, workspaceName } = outcome.activated;
    await audit(null, payment.workspaceId, "billing.plan_activated", { type: "payment", id: payment.id }, { plan: payment.plan, provider: providerId }, payment.userId);
    if (payment.userId) {
      const [user] = await db.select({ email: schema.users.email }).from(schema.users).where(eq(schema.users.id, payment.userId));
      if (user) sendMailInBackground(emails.paymentConfirmed(user.email, workspaceName, PLANS[payment.plan].name, expires));
    }
  }
  return { status: outcome.status };
}

/** Quita los días comprados por un pago reembolsado (una sola vez). */
async function revokeDays(tx: Tx, payment: Payment): Promise<void> {
  const moved = await tx
    .update(schema.payments)
    .set({ status: "refunded", refundedAt: new Date() })
    .where(and(eq(schema.payments.id, payment.id), eq(schema.payments.status, "paid")))
    .returning();
  if (moved.length === 0) return;
  const locked = await tx.execute<{ plan: string; plan_expires_at: Date | null }>(
    sql`SELECT plan, plan_expires_at FROM workspaces WHERE id = ${payment.workspaceId} FOR UPDATE`,
  );
  const workspace = locked.rows[0];
  if (!workspace || workspace.plan !== payment.plan || !workspace.plan_expires_at) return;
  const expires = new Date(new Date(workspace.plan_expires_at).getTime() - payment.days * DAY);
  await tx
    .update(schema.workspaces)
    .set(expires > new Date() ? { planExpiresAt: expires, updatedAt: new Date() } : { plan: "free", planExpiresAt: null, updatedAt: new Date() })
    .where(eq(schema.workspaces.id, payment.workspaceId));
}

/** Reembolso total iniciado por un administrador. */
export async function refundPayment(paymentId: string) {
  const [payment] = await db.select().from(schema.payments).where(eq(schema.payments.id, paymentId));
  if (!payment) throw notFound("Pago no encontrado");
  if (payment.status !== "paid") throw badRequest("Solo se reembolsan pagos cobrados");
  const provider = getProvider(payment.provider);
  if (!provider) throw badRequest("Proveedor desconocido");
  await provider.refund({ captureRef: payment.captureRef, providerRef: payment.providerRef, currency: payment.chargeCurrency }, payment.chargeCents, `refund-${payment.id}`);
  await db.transaction((tx) => revokeDays(tx, payment));
  await audit(null, payment.workspaceId, "billing.refunded", { type: "payment", id: payment.id }, { provider: payment.provider }, null);
  const [updated] = await db.select().from(schema.payments).where(eq(schema.payments.id, paymentId));
  return updated!;
}
