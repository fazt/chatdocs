import { Router } from "express";
import { db, schema } from "../db/index.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { eq } from "drizzle-orm";
import { first } from "../lib/utils.js";
import { validate } from "../middleware/validate.js";
import { updateOnboardingSchema } from "../schemas/onboarding.schema.js";
import type { z } from "zod";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const user = first(
      await db
        .select({ onboarding: schema.users.onboarding })
        .from(schema.users)
        .where(eq(schema.users.id, req.user!.userId))
    );

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ onboarding: JSON.parse(user.onboarding) });
  } catch (error) {
    console.error("[Get Onboarding Error]", error);
    res.status(500).json({ error: "Failed to get onboarding" });
  }
});

router.patch("/", requireAuth, validate(updateOnboardingSchema), async (req, res) => {
  try {
    const data = req.body as z.infer<typeof updateOnboardingSchema>;

    const user = first(
      await db
        .select({ onboarding: schema.users.onboarding })
        .from(schema.users)
        .where(eq(schema.users.id, req.user!.userId))
    );

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const current = JSON.parse(user.onboarding);
    const merged = { ...current, ...data };

    await db
      .update(schema.users)
      .set({ onboarding: JSON.stringify(merged) })
      .where(eq(schema.users.id, req.user!.userId));

    res.json({ onboarding: merged });
  } catch (error) {
    console.error("[Update Onboarding Error]", error);
    res.status(500).json({ error: "Failed to update onboarding" });
  }
});

export default router;
