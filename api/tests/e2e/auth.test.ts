import { describe, it, expect, jest, beforeAll, beforeEach } from "@jest/globals";
import type { Hono } from "hono";
import type { AuthEnv } from "../../src/middleware/auth.middleware.js";

const mockSelect = jest.fn();
const mockInsert = jest.fn();

jest.unstable_mockModule("../../src/db/index.js", () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    delete: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) }),
    update: jest.fn().mockReturnValue({ set: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) }) }),
  },
  schema: {
    users: "users",
    conversations: "conversations",
    messages: "messages",
    documents: "documents",
    chunks: "chunks",
    conversationDocuments: "conversationDocuments",
  },
}));

jest.unstable_mockModule("../../src/lib/email.js", () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
}));

let app: Hono<AuthEnv>;

beforeAll(async () => {
  const appModule = await import("../../src/app.js");
  app = appModule.default as Hono<AuthEnv>;
});

beforeEach(() => {
  mockSelect.mockReset();
  mockInsert.mockReset();
});

async function call(
  path: string,
  init: { method?: string; body?: any; cookies?: string } = {}
) {
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;

  if (init.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.body);
  }
  if (init.cookies) headers["Cookie"] = init.cookies;

  const res = await app.request(path, {
    method: init.method ?? "GET",
    headers,
    body,
  });
  return res;
}

describe("GET /api/health", () => {
  it("should return ok", async () => {
    const res = await call("/api/health");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("ok");
    expect(json.service).toBe("chatdocs-api");
  });
});

describe("POST /api/auth/register", () => {
  it("should return 400 if email is missing", async () => {
    const res = await call("/api/auth/register", {
      method: "POST",
      body: { password: "password123" },
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Validation failed");
  });

  it("should return 400 if password is missing", async () => {
    const res = await call("/api/auth/register", {
      method: "POST",
      body: { email: "test@example.com" },
    });
    expect(res.status).toBe(400);
  });

  it("should return 400 if password is too short", async () => {
    const res = await call("/api/auth/register", {
      method: "POST",
      body: { email: "test@example.com", password: "12345" },
    });
    expect(res.status).toBe(400);
  });

  it("should return 409 if email already exists", async () => {
    mockSelect.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([{ id: "existing-id" }]),
      }),
    });

    const res = await call("/api/auth/register", {
      method: "POST",
      body: { email: "existing@example.com", password: "password123" },
    });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("Email already registered");
  });

  it("should return 201 on successful registration", async () => {
    mockSelect.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([]),
      }),
    });
    mockInsert.mockReturnValue({
      values: jest.fn().mockResolvedValue(undefined),
    });

    const res = await call("/api/auth/register", {
      method: "POST",
      body: { email: "new@example.com", password: "password123" },
    });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.user).toBeDefined();
    expect(json.user.email).toBe("new@example.com");
  });
});

describe("POST /api/auth/login", () => {
  it("should return 400 if email is missing", async () => {
    const res = await call("/api/auth/login", {
      method: "POST",
      body: { password: "password123" },
    });
    expect(res.status).toBe(400);
  });

  it("should return 401 if user not found", async () => {
    mockSelect.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([]),
      }),
    });

    const res = await call("/api/auth/login", {
      method: "POST",
      body: { email: "notfound@example.com", password: "password123" },
    });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Invalid email or password");
  });
});

describe("POST /api/auth/logout", () => {
  it("should return success", async () => {
    const res = await call("/api/auth/logout", { method: "POST" });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});

describe("GET /api/auth/me", () => {
  it("should return null user when not authenticated", async () => {
    const res = await call("/api/auth/me");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.user).toBeNull();
  });
});
