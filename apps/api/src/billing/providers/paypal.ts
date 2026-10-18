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

const toPaypalAmount = toMajorUnits;

/**
 * PayPal Checkout (Orders v2) via API REST.
 * Flujo: crear orden -> el cliente aprueba en PayPal -> vuelve a
 * `GET /api/billing/paypal/return` -> capturamos la orden. El webhook
 * `PAYMENT.CAPTURE.COMPLETED` / `PAYMENT.CAPTURE.REFUNDED` cubre los casos en
 * que el cliente cierra la pestana antes de volver.
 */
export class PaypalProvider implements PaymentProvider {
  readonly id = 'paypal' as const;
  readonly label = 'PayPal';

  private get baseUrl(): string {
    return env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  }

  isEnabled(): boolean {
    return Boolean(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET && env.PAYPAL_WEBHOOK_ID);
  }

  private async token(): Promise<string> {
    const credentials = Buffer.from(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`).toString('base64');
    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    if (!response.ok) throw new Error(`PayPal: no se pudo autenticar (${response.status})`);
    return ((await response.json()) as { access_token: string }).access_token;
  }

  private async call<T>(path: string, body: unknown, requestId?: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await this.token()}`,
        'Content-Type': 'application/json',
        ...(requestId ? { 'PayPal-Request-Id': requestId } : {}),
      },
      body: JSON.stringify(body),
    });
    const json = (await response.json().catch(() => ({}))) as T & { message?: string };
    if (!response.ok) throw new Error(`PayPal: ${json.message ?? response.status}`);
    return json;
  }

  async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    const returnUrl = new URL(`${env.PUBLIC_API_URL}/api/billing/paypal/return`);
    returnUrl.searchParams.set('paymentId', request.paymentId);

    const order = await this.call<{ id: string; links: { rel: string; href: string }[] }>(
      '/v2/checkout/orders',
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: request.paymentId,
            custom_id: request.paymentId,
            description: request.description.slice(0, 127),
            amount: { currency_code: request.currency, value: toPaypalAmount(request.amountCents, request.currency) },
          },
        ],
        application_context: {
          return_url: returnUrl.toString(),
          cancel_url: request.cancelUrl,
          user_action: 'PAY_NOW',
          shipping_preference: 'NO_SHIPPING',
        },
      },
      request.paymentId,
    );

    const approve = order.links.find((link) => link.rel === 'approve' || link.rel === 'payer-action');
    if (!approve) throw new Error('PayPal: la orden no tiene enlace de aprobación');
    return { providerRef: order.id, url: approve.href };
  }

  /** Captura la orden aprobada (al volver el cliente). Idempotente por PayPal-Request-Id. */
  async capture(orderId: string): Promise<PaymentEvent | null> {
    const result = await this.call<{
      status: string;
      purchase_units: { payments?: { captures?: { id: string; status: string }[] } }[];
    }>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {}, `capture-${orderId}`);

    const capture = result.purchase_units[0]?.payments?.captures?.[0];
    if (result.status !== 'COMPLETED' || !capture) return null;
    return { eventId: `capture_${capture.id}`, type: 'paid', providerRef: orderId, captureRef: capture.id };
  }

  async parseWebhook(request: WebhookRequest): Promise<PaymentEvent | null> {
    const header = (name: string) => String(request.headers[name] ?? '');
    const event = JSON.parse(request.rawBody.toString('utf8')) as {
      id: string;
      event_type: string;
      resource: {
        id: string;
        custom_id?: string;
        supplementary_data?: { related_ids?: { order_id?: string } };
        links?: { rel: string; href: string }[];
      };
    };

    // Verificacion oficial de la firma (PayPal valida cert + firma + webhook id).
    const verification = await this.call<{ verification_status: string }>(
      '/v1/notifications/verify-webhook-signature',
      {
        auth_algo: header('paypal-auth-algo'),
        cert_url: header('paypal-cert-url'),
        transmission_id: header('paypal-transmission-id'),
        transmission_sig: header('paypal-transmission-sig'),
        transmission_time: header('paypal-transmission-time'),
        webhook_id: env.PAYPAL_WEBHOOK_ID,
        webhook_event: event,
      },
    );
    if (verification.verification_status !== 'SUCCESS') throw new WebhookSignatureError();

    const resource = event.resource;
    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        return {
          eventId: event.id,
          type: 'paid',
          paymentId: resource.custom_id,
          providerRef: resource.supplementary_data?.related_ids?.order_id,
          captureRef: resource.id,
        };
      case 'PAYMENT.CAPTURE.DENIED':
        return { eventId: event.id, type: 'failed', paymentId: resource.custom_id };
      case 'PAYMENT.CAPTURE.REFUNDED': {
        const up = resource.links?.find((link) => link.rel === 'up')?.href;
        return { eventId: event.id, type: 'refunded', paymentId: resource.custom_id, captureRef: up?.split('/').pop() };
      }
      default:
        return null;
    }
  }

  async refund(payment: RefundablePayment, amountCents: number, idempotencyKey: string): Promise<void> {
    if (!payment.captureRef) throw new Error('PayPal: el pago no tiene capture id para reembolsar');
    await this.call(
      `/v2/payments/captures/${encodeURIComponent(payment.captureRef)}/refund`,
      { amount: { currency_code: payment.currency, value: toPaypalAmount(amountCents, payment.currency) } },
      idempotencyKey,
    );
  }
}
