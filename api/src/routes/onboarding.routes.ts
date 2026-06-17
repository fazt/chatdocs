import { Hono } from "hono";
import { db, schema } from "../db/index.js";
import { requireAuth, type AuthEnv } from "../middleware/auth.middleware.js";
import { eq } from "drizzle-orm";
import { first } from "../lib/utils.js";
import { validate } from "../middleware/validate.js";
import { updateOnboardingSchema } from "../schemas/onboarding.schema.js";

const routes = new Hono<AuthEnv>();

routes.use("*", requireAuth);

routes.get("/", async (c) => {
  const user = c.get("user")!;
  try {
    const found = first(
      await db
        .select({ onboarding: schema.users.onboarding })
        .from(schema.users)
        .where(eq(schema.users.id, user.userId))
    );

    if (!found) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json({ onboarding: JSON.parse(found.onboarding) });
  } catch (error) {
    console.error("[Get Onboarding Error]", error);
    return c.json({ error: "Failed to get onboarding" }, 500);
  }
});

routes.patch("/", validate(updateOnboardingSchema), async (c) => {
  const user = c.get("user")!;
  const data = c.req.valid("json");

  try {
    const found = first(
      await db
        .select({ onboarding: schema.users.onboarding })
        .from(schema.users)
        .where(eq(schema.users.id, user.userId))
    );

    if (!found) {
      return c.json({ error: "User not found" }, 404);
    }

    const current = JSON.parse(found.onboarding);
    const merged = { ...current, ...data };

    await db
      .update(schema.users)
      .set({ onboarding: JSON.stringify(merged) })
      .where(eq(schema.users.id, user.userId));

    return c.json({ onboarding: merged });
  } catch (error) {
    console.error("[Update Onboarding Error]", error);
    return c.json({ error: "Failed to update onboarding" }, 500);
  }
});

export default routes;
