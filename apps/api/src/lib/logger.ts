import { pino } from "pino";
import { env, isProduction } from "../config/env.js";

/**
 * Logger estructurado (JSON). Nunca se registran cookies, cabeceras de
 * autorización ni query strings (pueden llevar tokens o firmas).
 */
export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : (env.LOG_LEVEL ?? (isProduction ? "info" : "debug")),
  base: { service: "folio-api" },
  redact: {
    paths: ["headers.cookie", "headers.authorization", "password", "token", "*.password", "*.token"],
    censor: "[oculto]",
  },
});
