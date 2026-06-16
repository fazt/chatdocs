import type { Request, Response, NextFunction } from "express";
import type { ZodSchema, ZodError } from "zod";

export function validate(schema: ZodSchema, source: "body" | "params" | "query" = "body") {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req[source]);
      next();
    } catch (error) {
      const zodError = error as ZodError;
      res.status(400).json({
        error: "Validation failed",
        details: zodError.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
  };
}