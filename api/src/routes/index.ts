import { Router } from "express";
import authRoutes from "./auth.routes.js";
import documentRoutes from "./documents.routes.js";
import conversationRoutes from "./conversations.routes.js";
import chatRoutes from "./chat.routes.js";
import adminRoutes from "./admin.routes.js";
import onboardingRoutes from "./onboarding.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/documents", documentRoutes);
router.use("/conversations", conversationRoutes);
router.use("/chat", chatRoutes);
router.use("/admin", adminRoutes);
router.use("/onboarding", onboardingRoutes);

export default router;
