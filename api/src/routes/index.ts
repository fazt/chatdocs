import { Hono } from "hono";
import authRoutes from "./auth.routes.js";
import documentRoutes from "./documents.routes.js";
import conversationRoutes from "./conversations.routes.js";
import chatRoutes from "./chat.routes.js";
import adminRoutes from "./admin.routes.js";
import onboardingRoutes from "./onboarding.routes.js";
import type { AuthEnv } from "../middleware/auth.middleware.js";

const routes = new Hono<AuthEnv>();

routes.route("/auth", authRoutes);
routes.route("/documents", documentRoutes);
routes.route("/conversations", conversationRoutes);
routes.route("/chat", chatRoutes);
routes.route("/admin", adminRoutes);
routes.route("/onboarding", onboardingRoutes);

export default routes;
