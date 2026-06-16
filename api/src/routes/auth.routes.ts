import { Router } from "express";
import { db, schema } from "../db/index.js";
import { hashPassword, verifyPassword, signToken, setAuthCookie, removeAuthCookie } from "../lib/auth.js";
import { uuid, now, first } from "../lib/utils.js";
import { optionalAuth } from "../middleware/auth.middleware.js";
import { sendWelcomeEmail } from "../lib/email.js";
import { eq } from "drizzle-orm";
import { validate } from "../middleware/validate.js";
import { registerSchema, loginSchema } from "../schemas/auth.schema.js";
import type { z } from "zod";

const router = Router();

router.post("/register", validate(registerSchema), async (req, res) => {
  try {
    const { email, password, name } = req.body as z.infer<typeof registerSchema>;

    const existing = first(
      await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, email))
    );

    if (existing) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    const id = uuid();
    const hashedPassword = await hashPassword(password);
    const role = "user";

    await db.insert(schema.users).values({
      id,
      email,
      hashedPassword,
      name: name || email.split("@")[0],
      role,
      createdAt: now(),
    });

    const token = signToken({ userId: id, email, role });
    setAuthCookie(res, token);

    sendWelcomeEmail(email, name || email.split("@")[0]).catch((err) =>
      console.error("[Welcome Email Error]", err)
    );

    res.status(201).json({
      user: { id, email, role, name: name || email.split("@")[0] },
    });
  } catch (error) {
    console.error("[Register Error]", error);
    res.status(500).json({ error: "Failed to register" });
  }
});

router.post("/login", validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body as z.infer<typeof loginSchema>;

    const user = first(
      await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, email))
    );

    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const valid = await verifyPassword(password, user.hashedPassword);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    setAuthCookie(res, token);

    res.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (error) {
    console.error("[Login Error]", error);
    res.status(500).json({ error: "Failed to login" });
  }
});

router.post("/logout", (_req, res) => {
  removeAuthCookie(res);
  res.json({ success: true });
});

router.get("/me", optionalAuth, async (req, res) => {
  try {
    if (!req.user) {
      res.json({ user: null });
      return;
    }

    const user = first(
      await db
        .select({ id: schema.users.id, email: schema.users.email, name: schema.users.name })
        .from(schema.users)
        .where(eq(schema.users.id, req.user.userId))
    );

    if (!user) {
      removeAuthCookie(res);
      res.json({ user: null });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error("[Me Error]", error);
    res.json({ user: null });
  }
});

export default router;
