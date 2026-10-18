import type { Context, MiddlewareHandler } from "hono";
import { tooManyRequests } from "./errors.js";
import { clientIp } from "./request.js";

/**
 * Límite de peticiones en memoria (ventana fija). Suficiente para una sola
 * instancia de la API; con varias réplicas habría que moverlo a Redis/Postgres.
 */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Cuenta un intento. Devuelve false si se superó el límite. */
  consume(key: string): boolean {
    const now = Date.now();
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      this.sweep(now);
      return true;
    }
    entry.count += 1;
    return entry.count <= this.limit;
  }

  /** ¿Está bloqueada la clave? (sin contar un intento nuevo). */
  isBlocked(key: string): boolean {
    const entry = this.hits.get(key);
    return Boolean(entry && entry.resetAt > Date.now() && entry.count >= this.limit);
  }

  reset(key: string): void {
    this.hits.delete(key);
  }

  private sweep(now: number): void {
    if (this.hits.size < 10_000) return;
    for (const [key, entry] of this.hits) if (entry.resetAt <= now) this.hits.delete(key);
  }
}

const MIN = 60_000;
const HOUR = 60 * MIN;

export const limiters = {
  /** Login: solo cuentan los intentos FALLIDOS (por IP y por email). */
  loginFailuresByIp: new RateLimiter(20, 15 * MIN),
  loginFailuresByEmail: new RateLimiter(8, 15 * MIN),
  /** Endpoints que responden 2xx y crean cuentas o envían correos: cuentan TODAS las peticiones. */
  register: new RateLimiter(5, HOUR),
  forgotByIp: new RateLimiter(5, HOUR),
  forgotByEmail: new RateLimiter(3, HOUR),
  resetPassword: new RateLimiter(10, HOUR),
  invitations: new RateLimiter(30, HOUR),
  /** Preguntas al modelo (además del cupo mensual del plan). */
  ask: new RateLimiter(20, MIN),
  uploads: new RateLimiter(60, HOUR),
  checkout: new RateLimiter(10, HOUR),
};

/** Middleware que cuenta toda petición por IP (o por usuario si hay sesión). */
export function rateLimit(limiter: RateLimiter, keyOf?: (c: Context) => string): MiddlewareHandler {
  return async (c, next) => {
    const key = keyOf ? keyOf(c) : clientIp(c);
    if (!limiter.consume(key)) throw tooManyRequests();
    await next();
  };
}
