import { describe, it, expect } from "@jest/globals";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { hashPassword, verifyPassword, signToken, verifyToken } from "../../src/lib/auth.js";

describe("auth lib", () => {
  describe("hashPassword & verifyPassword", () => {
    it("should hash and verify a password", async () => {
      const password = "test-password-123";
      const hash = await hashPassword(password);
      expect(hash).not.toBe(password);
      expect(hash.startsWith("$2")).toBe(true);

      const valid = await verifyPassword(password, hash);
      expect(valid).toBe(true);
    });

    it("should reject wrong password", async () => {
      const hash = await hashPassword("correct-password");
      const valid = await verifyPassword("wrong-password", hash);
      expect(valid).toBe(false);
    });
  });

  describe("signToken & verifyToken", () => {
    const payload = { userId: "123", email: "test@example.com", role: "user" as const };

    it("should sign a JWT token", () => {
      const token = signToken(payload);
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3);
    });

    it("should verify a valid token", () => {
      const token = signToken(payload);
      const decoded = verifyToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe("123");
      expect(decoded?.email).toBe("test@example.com");
      expect(decoded?.role).toBe("user");
    });

    it("should return null for an invalid token", () => {
      const decoded = verifyToken("invalid-token");
      expect(decoded).toBeNull();
    });

    it("should return null for a tampered token", () => {
      const token = signToken(payload);
      const tampered = token.slice(0, -5) + "XXXXX";
      const decoded = verifyToken(tampered);
      expect(decoded).toBeNull();
    });
  });
});
