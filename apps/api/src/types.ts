import type { MemberRole } from "./db/schema.js";
import type { PlanId } from "./config/plans.js";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  sessionId: string;
}

export interface WorkspaceContext {
  id: string;
  name: string;
  /** Plan vigente (un plan pagado caducado ya viene como "free"). */
  plan: PlanId;
  planExpiresAt: Date | null;
  role: MemberRole;
}

/** Variables de contexto de Hono compartidas por todas las rutas. */
export type AppEnv = {
  Variables: {
    requestId: string;
    user?: SessionUser;
    workspace?: WorkspaceContext;
  };
};
