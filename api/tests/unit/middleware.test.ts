import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import type { Request, Response, NextFunction } from "express";

jest.unstable_mockModule("../../src/lib/auth.js", () => ({
  verifyToken: jest.fn(),
}));

let requireAuth: typeof import("../../src/middleware/auth.middleware.js")["requireAuth"];
let optionalAuth: typeof import("../../src/middleware/auth.middleware.js")["optionalAuth"];
let requireAdmin: typeof import("../../src/middleware/auth.middleware.js")["requireAdmin"];
let mockVerifyToken: jest.Mock;

beforeEach(async () => {
  jest.resetModules();

  jest.unstable_mockModule("../../src/lib/auth.js", () => ({
    verifyToken: jest.fn(),
  }));

  const mod = await import("../../src/middleware/auth.middleware.js");
  const authMod = await import("../../src/lib/auth.js");
  requireAuth = mod.requireAuth;
  optionalAuth = mod.optionalAuth;
  requireAdmin = mod.requireAdmin;
  mockVerifyToken = (authMod as any).verifyToken;
});

function createReq(cookies?: string): Partial<Request> {
  return { cookies: cookies ? { chatdocs_token: cookies } : undefined } as Partial<Request>;
}

function createRes(): Partial<Response> {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res) as unknown as Response["status"];
  res.json = jest.fn().mockReturnValue(res) as unknown as Response["json"];
  return res;
}

describe("requireAuth", () => {
  it("should return 401 if no token cookie", () => {
    const req = createReq();
    const res = createRes();
    const next: NextFunction = jest.fn();

    requireAuth(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 401 if token is invalid", () => {
    mockVerifyToken.mockReturnValue(null);

    const req = createReq("invalid-token");
    const res = createRes();
    const next: NextFunction = jest.fn();

    requireAuth(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    expect(next).not.toHaveBeenCalled();
  });

  it("should set req.user and call next if token is valid", () => {
    const payload = { userId: "user-1", email: "test@example.com", role: "user" as const };
    mockVerifyToken.mockReturnValue(payload);

    const req = createReq("valid-token");
    const res = createRes();
    const next: NextFunction = jest.fn();

    requireAuth(req as Request, res as Response, next);

    expect((req as any).user).toEqual(payload);
    expect(next).toHaveBeenCalled();
  });
});

describe("optionalAuth", () => {
  it("should call next without user if no token", () => {
    const req = createReq();
    const res = createRes();
    const next: NextFunction = jest.fn();

    optionalAuth(req as Request, res as Response, next);

    expect((req as any).user).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it("should set user and call next if token is valid", () => {
    const payload = { userId: "user-1", email: "test@example.com", role: "user" as const };
    mockVerifyToken.mockReturnValue(payload);

    const req = createReq("valid-token");
    const res = createRes();
    const next: NextFunction = jest.fn();

    optionalAuth(req as Request, res as Response, next);

    expect((req as any).user).toEqual(payload);
    expect(next).toHaveBeenCalled();
  });
});

describe("requireAdmin", () => {
  it("should return 403 if user is not admin", () => {
    const req = { user: { userId: "1", email: "test@example.com", role: "user" } };
    const res = createRes();
    const next: NextFunction = jest.fn();

    requireAdmin(req as unknown as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Forbidden: admin access required" });
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 403 if no user", () => {
    const req = {} as Partial<Request>;
    const res = createRes();
    const next: NextFunction = jest.fn();

    requireAdmin(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("should call next if user is admin", () => {
    const req = { user: { userId: "1", email: "admin@example.com", role: "admin" } };
    const res = createRes();
    const next: NextFunction = jest.fn();

    requireAdmin(req as unknown as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
  });
});
