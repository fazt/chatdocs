import { describe, it, expect, jest, beforeAll, beforeEach } from "@jest/globals";
import request from "supertest";

const mockSelect = jest.fn();
const mockInsert = jest.fn();

jest.unstable_mockModule("../../src/db/index.js", () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
  },
  schema: {
    users: "users",
  },
}));

jest.unstable_mockModule("../../src/lib/email.js", () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
}));

let app: import("express").Express;

beforeAll(async () => {
  const appModule = await import("../../src/app.js");
  app = appModule.default;
});

beforeEach(() => {
  mockSelect.mockReset();
  mockInsert.mockReset();
});

describe("POST /api/auth/register", () => {
  it("should return 400 if email is missing", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ password: "password123" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Email and password are required");
  });

  it("should return 400 if password is missing", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "test@example.com" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Email and password are required");
  });

  it("should return 400 if password is too short", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "test@example.com", password: "12345" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Password must be at least 6 characters");
  });

  it("should return 409 if email already exists", async () => {
    mockSelect.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([{ id: "existing-id" }]),
      }),
    });

    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "existing@example.com", password: "password123" });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Email already registered");
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

    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "new@example.com", password: "password123" });

    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe("new@example.com");
  });
});

describe("POST /api/auth/login", () => {
  it("should return 400 if email is missing", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ password: "password123" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Email and password are required");
  });

  it("should return 401 if user not found", async () => {
    mockSelect.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([]),
      }),
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "notfound@example.com", password: "password123" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid email or password");
  });
});

describe("POST /api/auth/logout", () => {
  it("should return success", async () => {
    const res = await request(app).post("/api/auth/logout");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe("GET /api/auth/me", () => {
  it("should return null user when not authenticated", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
  });
});
