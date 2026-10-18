import type { PaymentProviderId } from './types.js';
import { MercadoPagoProvider } from './mercadopago.js';
import { PaypalProvider } from './paypal.js';
import { SimulatedProvider } from './simulated.js';
import { StripeProvider } from './stripe.js';
import type { PaymentProvider } from './types.js';

export const paypalProvider = new PaypalProvider();

const registry: Record<PaymentProviderId, PaymentProvider> = {
  stripe: new StripeProvider(),
  paypal: paypalProvider,
  mercadopago: new MercadoPagoProvider(),
  simulated: new SimulatedProvider(),
};

/**
 * Pasarelas activas: las reales con claves configuradas y, si
 * PAYMENTS_SIMULATED_ENABLED=true, la simulada (para demos y desarrollo).
 */
export function enabledProviders(): PaymentProvider[] {
  return (['stripe', 'paypal', 'mercadopago', 'simulated'] as const)
    .map((id) => registry[id])
    .filter((provider) => provider.isEnabled());
}

export function getProvider(id: string): PaymentProvider | null {
  return (registry as Record<string, PaymentProvider | undefined>)[id] ?? null;
}

/** Proveedor para cobrar: el pedido si esta activo, o el primero disponible. */
export function resolveProvider(requested?: string): PaymentProvider | null {
  const enabled = enabledProviders();
  if (requested) return enabled.find((provider) => provider.id === requested) ?? null;
  return enabled[0] ?? null;
}

export type { PaymentProvider } from './types.js';
