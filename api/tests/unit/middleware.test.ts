import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { Hono } from "hono";

jest.unstable_mockModule("../../src/lib/auth.js", () => ({
  verifyToken: jest.fn(),
  hashPassword: jest.fn(),
  signToken: jest.fn(),
  setAuthCookie: jest.fn(),
  removeAuthCookie: jest.fn(),
  TOKEN_COOKIE: "chatdocs_token",
}));

let mockVerifyToken: jest.Mock;
let requireAuth: typeof import("../../src/middleware/auth.middleware.js")["requireAuth"];
let optionalAuth: typeof import("../../src/middleware/auth.middleware.js")["optionalAuth"];
let requireAdmin: typeof import("../../src/middleware/auth.middleware.js")["requireAdmin"];

beforeEach(async () => {
  jest.resetModules();

  jest.unstable_mockModule("../../src/lib/auth.js", () => ({
    verifyToken: jest.fn(),
    hashPassword: jest.fn(),
    signToken: jest.fn(),
    setAuthCookie: jest.fn(),
    removeAuthCookie: jest.fn(),
    TOKEN_COOKIE: "chatdocs_token",
  }));

  const mod = await import("../../src/middleware/auth.middleware.js");
  const authMod = await import("../../src/lib/auth.js");
  requireAuth = mod.requireAuth;
  optionalAuth = mod.optionalAuth;
  requireAdmin = mod.requireAdmin;
  mockVerifyToken = (authMod as any).verifyToken;
});

function buildApp(useMiddleware: any) {
  const app = new Hono();
  app.get("/protected", useMiddleware, (c) =>
    c.json({ user: c.get("user" as any) ?? null })
  );
  return app;
}

async function callApp(
  app: Hono,
  cookies?: string
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = {};
  if (cookies) headers["Cookie"] = cookies;
  const res = await app.request("/protected", { headers });
  return { status: res.status, body: await res.json() };
}

describe("requireAuth", () => {
  it("should return 401 if no token cookie", async () => {
    const app = buildApp(requireAuth);
    const { status, body } = await callApp(app);
    expect(status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("should return 401 if token is invalid", async () => {
    mockVerifyToken.mockReturnValue(null);
    const app = buildApp(requireAuth);
    const { status, body } = await callApp(app, "chatdocs_token=invalid-token");
    expect(status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("should set user and call next if token is valid", async () => {
    const payload = { userId: "user-1", email: "test@example.com", role: "user" as const };
    mockVerifyToken.mockReturnValue(payload);
    const app = buildApp(requireAuth);
    const { status, body } = await callApp(app, "chatdocs_token=valid-token");
    expect(status).toBe(200);
    expect(body.user).toEqual(payload);
  });
});

describe("optionalAuth", () => {
  it("should call next without user if no token", async () => {
    const app = buildApp(optionalAuth);
    const { status, body } = await callApp(app);
    expect(status).toBe(200);
    expect(body.user).toBeNull();
  });

  it("should set user and call next if token is valid", async () => {
    const payload = { userId: "user-1", email: "test@example.com", role: "user" as const };
    mockVerifyToken.mockReturnValue(payload);
    const app = buildApp(optionalAuth);
    const { status, body } = await callApp(app, "chatdocs_token=valid-token");
    expect(status).toBe(200);
    expect(body.user).toEqual(payload);
  });
});

describe("requireAdmin", () => {
  function buildAdminApp(middleware: any, seedUser?: any) {
    const app = new Hono<{ Variables: { user?: any } }>();
    if (seedUser !== undefined) {
      app.use("*", async (c, next) => {
        if (seedUser) c.set("user", seedUser);
        await next();
      });
    }
    app.get("/admin", middleware, (c) => c.json({ ok: true }));
    return app;
  }

  async function callAdmin(middleware: any, seedUser?: any) {
    const app = buildAdminApp(middleware, seedUser);
    const res = await app.request("/admin");
    return { status: res.status, body: await res.json() };
  }

  it("should return 403 if user is not admin", async () => {
    const { status, body } = await callAdmin(requireAdmin, {
      userId: "1",
      email: "test@example.com",
      role: "user",
    });
    expect(status).toBe(403);
    expect(body.error).toBe("Forbidden: admin access required");
  });

  it("should return 403 if no user (no token)", async () => {
    const { status } = await callAdmin(requireAdmin, null);
    expect(status).toBe(403);
  });

  it("should call next if user is admin", async () => {
    const { status, body } = await callAdmin(requireAdmin, {
      userId: "1",
      email: "admin@example.com",
      role: "admin",
    });
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
  });
});
