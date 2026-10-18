import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

/** Token opaco aleatorio (sesiones, enlaces de un solo uso). Solo se guarda su hash. */
export const randomToken = (bytes = 32): string => randomBytes(bytes).toString("base64url");

export const sha256 = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** HMAC con propósito: el mismo valor firmado para dos usos distintos da firmas distintas. */
export function signValue(purpose: string, value: string): string {
  return createHmac("sha256", env.APP_SECRET).update(`${purpose}:${value}`).digest("base64url");
}

/** Token del checkout simulado: solo quien inició el pago puede completarlo. */
export const simulatedPaymentToken = (paymentId: string): string => signValue("simulated-payment", paymentId);
export const verifySimulatedPaymentToken = (paymentId: string, token: string | null | undefined): boolean =>
  verifySignedValue("simulated-payment", paymentId, token);

export const verifySignedValue =(purpose: string, value: string, signature: string | null | undefined): boolean =>
  Boolean(signature) && safeEqual(signValue(purpose, value), signature!);
