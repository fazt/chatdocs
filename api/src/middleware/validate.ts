import { zValidator } from "@hono/zod-validator";
import type { ZodSchema } from "zod";
import type { Context } from "hono";

type Source = "json" | "param" | "query";

export function validate<T extends ZodSchema>(schema: T, source: Source = "json") {
  return zValidator(source, schema, (result, c: Context) => {
    if (!result.success) {
      return c.json(
        {
          error: "Validation failed",
          details: result.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        400
      );
    }
    return undefined;
  });
}
