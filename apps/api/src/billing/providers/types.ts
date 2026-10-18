export const PAYMENT_PROVIDER_IDS = ['stripe', 'paypal', 'mercadopago', 'simulated'] as const;
export type PaymentProviderId = (typeof PAYMENT_PROVIDER_IDS)[number];

export interface CheckoutRequest {
  paymentId: string;
  /** Código legible de la orden (aparece en la pasarela). */
  reference: string;
  description: string;
  amountCents: number;
  /** ISO 4217 en mayusculas (USD, MXN...). */
  currency: string;
  customerEmail: string;
  /** A donde vuelve el cliente al terminar o cancelar el pago. */
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSession {
  /** Id de la sesion/orden/preferencia en el proveedor. */
  providerRef: string;
  /** URL a la que se redirige al cliente para pagar. */
  url: string;
}

/** Evento normalizado tras verificar la firma del webhook. */
export interface PaymentEvent {
  /** Id unico del evento en el proveedor: clave de idempotencia. */
  eventId: string;
  type: 'paid' | 'failed' | 'refunded';
  /** Para localizar el pago: nuestro id (metadata) o el providerRef de la sesion. */
  paymentId?: string;
  providerRef?: string;
  /** Id del cobro capturado, necesario para reembolsar. */
  captureRef?: string;
  amountCents?: number;
}

export interface WebhookRequest {
  rawBody: Buffer;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, unknown>;
}

/**
 * Contrato comun de las pasarelas. Anadir una nueva (Culqi, Wompi...) es
 * implementar esta interfaz y registrarla en `providers/index.ts`.
 */
export interface PaymentProvider {
  readonly id: PaymentProviderId;
  readonly label: string;
  /** Activo solo si sus variables de entorno estan definidas. */
  isEnabled(): boolean;
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
  /**
   * Verifica la firma y traduce el webhook. Devuelve `null` si el evento no
   * interesa (otros tipos). Lanza si la firma no es valida.
   */
  parseWebhook(request: WebhookRequest): Promise<PaymentEvent | null>;
  /**
   * Reembolsa `amountCents` (parcial o total) del cobro. `idempotencyKey` es
   * único por reembolso: dos parciales del mismo cobro no se deduplican.
   */
  refund(payment: RefundablePayment, amountCents: number, idempotencyKey: string): Promise<void>;
}

export interface RefundablePayment {
  captureRef: string | null;
  providerRef: string | null;
  currency: string;
}

export class WebhookSignatureError extends Error {
  constructor(message = 'Firma de webhook inválida') {
    super(message);
    this.name = 'WebhookSignatureError';
  }
}
