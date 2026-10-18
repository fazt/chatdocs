import type { ContentfulStatusCode } from "hono/utils/http-status";

/** Error con código HTTP. El manejador central lo convierte en `{ error, code }`. */
export class HttpError extends Error {
  constructor(
    public readonly status: ContentfulStatusCode,
    message: string,
    public readonly code = "ERROR",
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const badRequest = (message: string, code = "BAD_REQUEST", details?: unknown) => new HttpError(400, message, code, details);
export const unauthorized = (message = "Inicia sesión para continuar") => new HttpError(401, message, "UNAUTHORIZED");
export const forbidden = (message = "No tienes permiso para esta acción") => new HttpError(403, message, "FORBIDDEN");
export const notFound = (message = "No encontrado") => new HttpError(404, message, "NOT_FOUND");
export const conflict = (message: string, code = "CONFLICT") => new HttpError(409, message, code);
export const payloadTooLarge = (message: string) => new HttpError(413, message, "PAYLOAD_TOO_LARGE");
export const unprocessable = (message: string, code = "UNPROCESSABLE") => new HttpError(422, message, code);
export const tooManyRequests = (message = "Demasiadas peticiones, espera un momento") => new HttpError(429, message, "RATE_LIMITED");
export const planLimit = (message: string) => new HttpError(402, message, "PLAN_LIMIT");
export const failedDependency = (message: string) => new HttpError(502, message, "UPSTREAM_ERROR");
