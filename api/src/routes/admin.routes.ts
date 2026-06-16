import { Router } from "express";
import { db, schema } from "../db/index.js";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";
import { eq } from "drizzle-orm";
import { validate } from "../middleware/validate.js";
import { userIdParamSchema, updateRoleSchema } from "../schemas/admin.schema.js";
import { first } from "../lib/utils.js";
import type { z } from "zod";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/users", async (_req, res) => {
  try {
    const users = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        role: schema.users.role,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .orderBy(schema.users.createdAt);

    res.json({ users });
  } catch (error) {
    console.error("[Admin List Users Error]", error);
    res.status(500).json({ error: "Failed to list users" });
  }
});

router.patch(
  "/users/:id/role",
  validate(userIdParamSchema, "params"),
  validate(updateRoleSchema),
  async (req, res) => {
    try {
      const { id } = req.params as z.infer<typeof userIdParamSchema>;
      const { role } = req.body as z.infer<typeof updateRoleSchema>;

      const user = first(
        await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, id))
      );

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      await db
        .update(schema.users)
        .set({ role })
        .where(eq(schema.users.id, id));

      res.json({ success: true, user: { id: user.id, email: user.email, name: user.name, role } });
    } catch (error) {
      console.error("[Admin Update Role Error]", error);
      res.status(500).json({ error: "Failed to update user role" });
    }
  }
);

router.delete(
  "/users/:id",
  validate(userIdParamSchema, "params"),
  async (req, res) => {
    try {
      const { id } = req.params as z.infer<typeof userIdParamSchema>;

      if (id === req.user!.userId) {
        res.status(400).json({ error: "Cannot delete yourself" });
        return;
      }

      const user = first(
        await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, id))
      );

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      await db.delete(schema.users).where(eq(schema.users.id, id));
      res.json({ success: true });
    } catch (error) {
      console.error("[Admin Delete User Error]", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  }
);

export default router;
