import { Hono } from "hono";
import { db, schema } from "../db/index.js";
import { requireAuth, requireAdmin, type AuthEnv } from "../middleware/auth.middleware.js";
import { eq } from "drizzle-orm";
import { validate } from "../middleware/validate.js";
import { userIdParamSchema, updateRoleSchema } from "../schemas/admin.schema.js";
import { first } from "../lib/utils.js";

const routes = new Hono<AuthEnv>();

routes.use("*", requireAuth, requireAdmin);

routes.get("/users", async (c) => {
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

    return c.json({ users });
  } catch (error) {
    console.error("[Admin List Users Error]", error);
    return c.json({ error: "Failed to list users" }, 500);
  }
});

routes.patch(
  "/users/:id/role",
  validate(userIdParamSchema, "param"),
  validate(updateRoleSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const { role } = c.req.valid("json");

    try {
      const user = first(
        await db.select().from(schema.users).where(eq(schema.users.id, id))
      );

      if (!user) {
        return c.json({ error: "User not found" }, 404);
      }

      await db.update(schema.users).set({ role }).where(eq(schema.users.id, id));

      return c.json({
        success: true,
        user: { id: user.id, email: user.email, name: user.name, role },
      });
    } catch (error) {
      console.error("[Admin Update Role Error]", error);
      return c.json({ error: "Failed to update user role" }, 500);
    }
  }
);

routes.delete("/users/:id", validate(userIdParamSchema, "param"), async (c) => {
  const user = c.get("user")!;
  const { id } = c.req.valid("param");

  try {
    if (id === user.userId) {
      return c.json({ error: "Cannot delete yourself" }, 400);
    }

    const target = first(
      await db.select().from(schema.users).where(eq(schema.users.id, id))
    );

    if (!target) {
      return c.json({ error: "User not found" }, 404);
    }

    await db.delete(schema.users).where(eq(schema.users.id, id));
    return c.json({ success: true });
  } catch (error) {
    console.error("[Admin Delete User Error]", error);
    return c.json({ error: "Failed to delete user" }, 500);
  }
});

export default routes;
