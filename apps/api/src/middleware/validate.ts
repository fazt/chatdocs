import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import type { ZodType } from "zod";
import { badRequest } from "../lib/errors.js";

/**
 * Valida `json`, `query`, `param` o `form` con zod. Los errores se lanzan como
 * HttpError 400 con el detalle por campo, y el manejador central los responde.
 */
export function validate<T extends ZodType, Target extends keyof ValidationTargets>(target: Target, schema: T) {
  return zValidator(target, schema, (result) => {
    if (!result.success) {
      throw badRequest(
        "Datos inválidos",
        "VALIDATION_ERROR",
        result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      );
    }
  });
}
