import { createHmac, timingSafeEqual } from 'node:crypto';
import { toMajorUnits } from '../../lib/money.js';
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

const API = 'https://api.mercadopago.com';

/**
 * Mercado Pago Checkout Pro via API REST.
 * - Preferencia con `external_reference = paymentId` y `notification_url` al webhook.
 * - Webhook firmado con `x-signature` (ts + v1 = HMAC-SHA256 del manifest).
 * - El estado real se consulta siempre a la API (`GET /v1/payments/:id`).
 * Con un access token de prueba (`TEST-...`) todo ocurre en el sandbox.
 */
export class MercadoPagoProvider implements PaymentProvider {
  readonly id = 'mercadopago' as const;
  readonly label = 'Mercado Pago';

  isEnabled(): boolean {
    return Boolean(env.MERCADOPAGO_ACCESS_TOKEN && env.MERCADOPAGO_WEBHOOK_SECRET);
  }

  private async call<T>(method: 'GET' | 'POST', path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
    const response = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await response.json().catch(() => ({}))) as T & { message?: string };
    if (!response.ok) throw new Error(`Mercado Pago: ${json.message ?? response.status}`);
    return json;
  }

  async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    const preference = await this.call<{ id: string; init_point: string; sandbox_init_point?: string }>(
      'POST',
      '/checkout/preferences',
      {
        items: [
          {
            id: request.reference,
            title: request.description,
            quantity: 1,
            currency_id: request.currency,
            unit_price: Number(toMajorUnits(request.amountCents, request.currency)),
          },
        ],
        payer: { email: request.customerEmail },
        external_reference: request.paymentId,
        back_urls: { success: request.successUrl, failure: request.cancelUrl, pending: request.successUrl },
        auto_return: 'approved',
        notification_url: `${env.PUBLIC_API_URL}/api/billing/webhooks/mercadopago`,
      },
      request.paymentId,
    );

    const isTest = env.MERCADOPAGO_ACCESS_TOKEN?.startsWith('TEST-');
    return { providerRef: preference.id, url: (isTest && preference.sandbox_init_point) || preference.init_point };
  }

  async parseWebhook(request: WebhookRequest): Promise<PaymentEvent | null> {
    const body = JSON.parse(request.rawBody.toString('utf8') || '{}') as { type?: string; data?: { id?: string } };
    const dataId = String(request.query['data.id'] ?? body.data?.id ?? '');
    const topic = String(request.query['type'] ?? body.type ?? '');

    const signature = String(request.headers['x-signature'] ?? '');
    const requestId = String(request.headers['x-request-id'] ?? '');
    const parts = Object.fromEntries(
      signature.split(',').map((item) => item.trim().split('=') as [string, string]),
    );
    if (!parts['ts'] || !parts['v1'] || !dataId) throw new WebhookSignatureError();

    const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts['ts']};`;
    const expected = createHmac('sha256', env.MERCADOPAGO_WEBHOOK_SECRET!).update(manifest).digest('hex');
    if (expected.length !== parts['v1'].length || !timingSafeEqual(Buffer.from(expected), Buffer.from(parts['v1']))) {
      throw new WebhookSignatureError();
    }

    if (topic !== 'payment') return null;

    // Nunca confiamos en el cuerpo: pedimos el estado real del pago.
    const payment = await this.call<{ id: number; status: string; external_reference?: string; transaction_amount: number }>(
      'GET',
      `/v1/payments/${encodeURIComponent(dataId)}`,
    );

    const type =
      payment.status === 'approved'
        ? 'paid'
        : payment.status === 'refunded' || payment.status === 'charged_back'
          ? 'refunded'
          : payment.status === 'rejected' || payment.status === 'cancelled'
            ? 'failed'
            : null;
    if (!type) return null;

    return {
      eventId: `${payment.id}_${payment.status}`,
      type,
      paymentId: payment.external_reference,
      captureRef: String(payment.id),
      amountCents: Math.round(payment.transaction_amount * 100),
    };
  }

  async refund(payment: RefundablePayment, amountCents: number, idempotencyKey: string): Promise<void> {
    if (!payment.captureRef) throw new Error('Mercado Pago: el pago no tiene id para reembolsar');
    await this.call(
      'POST',
      `/v1/payments/${encodeURIComponent(payment.captureRef)}/refunds`,
      { amount: Number(toMajorUnits(amountCents, payment.currency)) },
      idempotencyKey,
    );
  }
}
