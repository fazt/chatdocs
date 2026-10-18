import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { env } from "../config/env.js";
import { PAID_PLAN_IDS, PLANS } from "../config/plans.js";
import { db, schema } from "../db/client.js";
import { handlePaymentEvent, listProviders, startCheckout } from "../billing/service.js";
import { getProvider, paypalProvider } from "../billing/providers/index.js";
import { PAYMENT_PROVIDER_IDS, WebhookSignatureError, type PaymentProviderId } from "../billing/providers/types.js";
import { audit } from "../lib/audit.js";
import { notFound, tooManyRequests } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { limiters } from "../lib/rate-limit.js";
import { currentUser } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { currentWorkspace, requireRole } from "../middleware/workspace.js";
import type { AppEnv } from "../types.js";

const checkoutSchema = z.object({ plan: z.enum(PAID_PLAN_IDS), provider: z.enum(PAYMENT_PROVIDER_IDS) });
const UUID = /^[0-9a-f-]{36}$/i;
const WEBHOOK_MAX_BYTES = 1024 * 1024;

/** Plan del espacio: /api/workspaces/:workspaceId/billing */
export const workspaceBillingRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const workspace = currentWorkspace(c);
    const payments =
      workspace.role === "owner"
        ? await db
            .select({
              id: schema.payments.id,
              provider: schema.payments.provider,
              plan: schema.payments.plan,
              status: schema.payments.status,
              amountCents: schema.payments.amountCents,
              currency: schema.payments.currency,
              chargeCents: schema.payments.chargeCents,
              chargeCurrency: schema.payments.chargeCurrency,
              days: schema.payments.days,
              createdAt: schema.payments.createdAt,
              paidAt: schema.payments.paidAt,
            })
            .from(schema.payments)
            .where(eq(schema.payments.workspaceId, workspace.id))
            .orderBy(desc(schema.payments.createdAt))
            .limit(30)
        : [];
    return c.json({ plan: workspace.plan, planExpiresAt: workspace.planExpiresAt, plans: Object.values(PLANS), providers: listProviders(), payments });
  })

  .post("/checkout", requireRole("owner"), validate("json", checkoutSchema), async (c) => {
    const user = currentUser(c);
    const workspace = currentWorkspace(c);
    if (!limiters.checkout.consume(user.id)) throw tooManyRequests();
    const { plan, provider } = c.req.valid("json");
    const result = await startCheckout(workspace.id, user.id, user.email, plan, provider);
    await audit(c, workspace.id, "billing.checkout_started", { type: "payment", id: result.paymentId }, { plan, provider });
    return c.json(result, 201);
  });

/** Público: planes (landing/precios) y webhooks firmados de las pasarelas. */
export const publicBillingRoutes = new Hono<AppEnv>()
  .get("/plans", (c) => c.json({ plans: Object.values(PLANS), providers: listProviders() }))

  /**
   * Webhooks. La firma se calcula sobre los bytes EXACTOS del cuerpo: se lee el
   * raw body (arrayBuffer) antes de cualquier parseo. Ningún plan se activa
   * sin pasar por aquí (o por la captura de PayPal).
   */
  .post("/webhooks/:provider", async (c) => {
    const providerId = c.req.param("provider");
    if (!(PAYMENT_PROVIDER_IDS as readonly string[]).includes(providerId)) throw notFound("Proveedor desconocido");
    const provider = getProvider(providerId);
    if (!provider?.isEnabled()) throw notFound("Proveedor no habilitado");

    const raw = Buffer.from(await c.req.arrayBuffer());
    if (raw.length > WEBHOOK_MAX_BYTES) return c.json({ error: "Cuerpo demasiado grande" }, 413);

    let event;
    try {
      event = await provider.parseWebhook({ rawBody: raw, headers: c.req.header(), query: c.req.query() });
    } catch (error) {
      if (error instanceof WebhookSignatureError) {
        logger.warn({ provider: providerId, reason: error.message }, "webhook rechazado");
        return c.json({ error: error.message, code: "INVALID_SIGNATURE" }, 400);
      }
      throw error;
    }
    if (!event) return c.json({ received: true, status: "ignored" });
    return c.json({ received: true, ...(await handlePaymentEvent(providerId as PaymentProviderId, event)) });
  })

  /** Retorno de PayPal: se captura la orden aprobada y se vuelve a la página del plan. */
  .get("/paypal/return", async (c) => {
    const paymentId = c.req.query("paymentId") ?? "";
    const orderId = c.req.query("token") ?? "";
    const [payment] = UUID.test(paymentId)
      ? await db.select().from(schema.payments).where(and(eq(schema.payments.id, paymentId), eq(schema.payments.provider, "paypal")))
      : [];
    const back = payment ? `${env.APP_URL}/app/${payment.workspaceId}/plan` : `${env.APP_URL}/app`;
    if (!payment || !paypalProvider.isEnabled() || payment.providerRef !== orderId) return c.redirect(`${back}?pago=error`);
    try {
      const event = await paypalProvider.capture(orderId);
      if (event) await handlePaymentEvent("paypal", { ...event, paymentId: payment.id });
      return c.redirect(`${back}?pago=ok`);
    } catch (error) {
      logger.error({ err: error, paymentId }, "no se pudo capturar la orden de PayPal");
      return c.redirect(`${back}?pago=error`);
    }
  });
