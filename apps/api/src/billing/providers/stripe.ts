import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';
import {
  WebhookSignatureError,
  type CheckoutRequest,
  type CheckoutSession,
  type PaymentEvent,
  type PaymentProvider,
  type RefundablePayment,
  type WebhookRequest,
} from './types.js';

const API = 'https://api.stripe.com/v1';
/** Tolerancia de la marca de tiempo de la firma (anti-replay), como el SDK oficial. */
const TOLERANCE_SECONDS = 300;

/**
 * Stripe Checkout via API REST (sin SDK).
 * Usa claves de test (`sk_test_...`) mientras el proyecto este en modo demo.
 * Webhook: `checkout.session.completed`, `checkout.session.async_payment_failed`
 * y `charge.refunded` en `POST /api/billing/webhooks/stripe`.
 */
export class StripeProvider implements PaymentProvider {
  readonly id = 'stripe' as const;
  readonly label = 'Tarjeta (Stripe)';

  isEnabled(): boolean {
    return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);
  }

  private async call<T>(path: string, params: Record<string, string>, idempotencyKey?: string): Promise<T> {
    const response = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': idempotencyKey ?? params['metadata[paymentId]'] ?? crypto.randomUUID(),
      },
      body: new URLSearchParams(params).toString(),
    });
    const json = (await response.json()) as T & { error?: { message?: string } };
    if (!response.ok) throw new Error(`Stripe: ${json.error?.message ?? response.status}`);
    return json;
  }

  async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    const session = await this.call<{ id: string; url: string }>('/checkout/sessions', {
      mode: 'payment',
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': request.currency.toLowerCase(),
      'line_items[0][price_data][unit_amount]': String(request.amountCents),
      'line_items[0][price_data][product_data][name]': request.description,
      customer_email: request.customerEmail,
      client_reference_id: request.paymentId,
      'metadata[paymentId]': request.paymentId,
      'payment_intent_data[metadata][paymentId]': request.paymentId,
      // La sesión caduca a los 30 min (mínimo de Stripe); un pago tardío se
      // recupera si aún queda cupo y si no se reembolsa solo.
      expires_at: String(Math.floor(Date.now() / 1000) + 30 * 60),
      success_url: request.successUrl,
      cancel_url: request.cancelUrl,
    });
    return { providerRef: session.id, url: session.url };
  }

  async parseWebhook(request: WebhookRequest): Promise<PaymentEvent | null> {
    const header = String(request.headers['stripe-signature'] ?? '');
    const parts = Object.fromEntries(
      header.split(',').map((item) => item.split('=') as [string, string]),
    );
    const timestamp = Number(parts['t']);
    const signatures = header
      .split(',')
      .filter((item) => item.startsWith('v1='))
      .map((item) => item.slice(3));

    if (!timestamp || signatures.length === 0) throw new WebhookSignatureError();
    if (Math.abs(Date.now() / 1000 - timestamp) > TOLERANCE_SECONDS) {
      throw new WebhookSignatureError('Firma de Stripe caducada');
    }

    const expected = createHmac('sha256', env.STRIPE_WEBHOOK_SECRET!)
      .update(`${timestamp}.${request.rawBody.toString('utf8')}`)
      .digest('hex');
    const valid = signatures.some(
      (signature) =>
        signature.length === expected.length &&
        timingSafeEqual(Buffer.from(signature), Buffer.from(expected)),
    );
    if (!valid) throw new WebhookSignatureError();

    const event = JSON.parse(request.rawBody.toString('utf8')) as {
      id: string;
      type: string;
      data: { object: Record<string, unknown> };
    };
    const object = event.data.object;
    const metadata = (object['metadata'] ?? {}) as Record<string, string>;

    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        if (object['payment_status'] !== 'paid') return null;
        return {
          eventId: event.id,
          type: 'paid',
          paymentId: metadata['paymentId'],
          providerRef: String(object['id']),
          captureRef: object['payment_intent'] ? String(object['payment_intent']) : undefined,
          amountCents: Number(object['amount_total'] ?? 0),
        };
      case 'checkout.session.async_payment_failed':
      case 'checkout.session.expired':
        return { eventId: event.id, type: 'failed', paymentId: metadata['paymentId'], providerRef: String(object['id']) };
      case 'charge.refunded':
        return {
          eventId: event.id,
          type: 'refunded',
          paymentId: metadata['paymentId'],
          captureRef: object['payment_intent'] ? String(object['payment_intent']) : undefined,
        };
      default:
        return null;
    }
  }

  async refund(payment: RefundablePayment, amountCents: number, idempotencyKey: string): Promise<void> {
    if (!payment.captureRef) throw new Error('Stripe: el pago no tiene payment_intent para reembolsar');
    await this.call(
      '/refunds',
      { payment_intent: payment.captureRef, amount: String(amountCents) },
      idempotencyKey,
    );
  }
}
