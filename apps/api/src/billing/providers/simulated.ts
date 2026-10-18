import { env } from '../../config/env.js';
import { simulatedPaymentToken, verifySimulatedPaymentToken } from '../../lib/crypto.js';
import {
  WebhookSignatureError,
  type CheckoutRequest,
  type CheckoutSession,
  type PaymentEvent,
  type PaymentProvider,
  type WebhookRequest,
} from './types.js';

/**
 * Pasarela simulada para la demo y el desarrollo: no mueve dinero.
 *
 * El "checkout" es una pagina de la web (`/pago/simulado`) que llama a
 * `POST /api/billing/webhooks/simulated` con un token firmado, recorriendo el
 * mismo camino (idempotente) que un webhook real.
 */
export class SimulatedProvider implements PaymentProvider {
  readonly id = 'simulated' as const;
  readonly label = 'Pago de prueba (simulado)';

  isEnabled(): boolean {
    return env.PAYMENTS_SIMULATED_ENABLED;
  }

  async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    const token = simulatedPaymentToken(request.paymentId);
    const url = new URL(`${env.APP_URL}/pago/simulado`);
    url.searchParams.set('payment', request.paymentId);
    url.searchParams.set('t', token);
    url.searchParams.set('code', request.reference);
    url.searchParams.set('amount', String(request.amountCents));
    url.searchParams.set('currency', request.currency);
    url.searchParams.set('ok', request.successUrl);
    url.searchParams.set('ko', request.cancelUrl);
    return { providerRef: `sim_${request.paymentId}`, url: url.toString() };
  }

  async parseWebhook(request: WebhookRequest): Promise<PaymentEvent | null> {
    let body: { paymentId?: string; token?: string; outcome?: string };
    try {
      body = JSON.parse(request.rawBody.toString('utf8'));
    } catch {
      throw new WebhookSignatureError('Cuerpo inválido');
    }

    if (!body.paymentId || !verifySimulatedPaymentToken(body.paymentId, body.token)) {
      throw new WebhookSignatureError();
    }

    const type = body.outcome === 'failed' ? 'failed' : 'paid';
    return {
      eventId: `sim_${body.paymentId}_${type}`,
      type,
      paymentId: body.paymentId,
      captureRef: `sim_capture_${body.paymentId}`,
    };
  }

  async refund(): Promise<void> {
    // Nada que devolver: no hubo cobro real.
  }
}
