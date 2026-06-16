import { z } from "zod";

export const userIdParamSchema = z.object({
  id: z.string().uuid("Invalid user ID format"),
});

export const updateRoleSchema = z.object({
  role: z.enum(["user", "admin"], {
    message: "Role must be 'user' or 'admin'",
  }),
});