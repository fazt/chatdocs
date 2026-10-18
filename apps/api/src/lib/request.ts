import type { Context } from "hono";
import { getConnInfo } from "@hono/node-server/conninfo";
import { env } from "../config/env.js";

/**
 * IP del cliente. Detrás de nginx (TRUST_PROXY=true) se usa el último salto
 * añadido por el proxy de confianza en X-Forwarded-For; si no, la del socket.
 */
export function clientIp(c: Context): string {
  if (env.TRUST_PROXY) {
    const real = c.req.header("x-real-ip");
    if (real) return real.trim();
    const forwarded = c.req.header("x-forwarded-for");
    if (forwarded) {
      const hops = forwarded.split(",").map((h) => h.trim()).filter(Boolean);
      const last = hops.at(-1);
      if (last) return last;
    }
  }
  try {
    return getConnInfo(c).remote.address ?? "desconocida";
  } catch {
    return "desconocida";
  }
}

export const userAgent = (c: Context): string | null => c.req.header("user-agent")?.slice(0, 300) ?? null;
