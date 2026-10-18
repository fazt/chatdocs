/** Monedas sin decimales: el monto "en centavos" es 100× la unidad. */
const ZERO_DECIMAL = new Set(["CLP", "JPY", "PYG", "KRW", "VND"]);

/** Centavos → unidad que piden las pasarelas ("19.00"). */
export function toMajorUnits(cents: number, currency: string): string {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? String(Math.round(cents / 100)) : (cents / 100).toFixed(2);
}

/** Convierte un precio en USD (centavos) a otra moneda con un tipo de cambio fijo, redondeando a la unidad mínima. */
export function convertCents(usdCents: number, rate: number, currency: string): number {
  const cents = Math.round(usdCents * rate);
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? Math.round(cents / 100) * 100 : cents;
}
