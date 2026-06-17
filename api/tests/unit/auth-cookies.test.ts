import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import {
  setAuthCookie,
  removeAuthCookie,
  TOKEN_COOKIE,
} from "../../src/lib/auth.js";

describe("auth cookie helpers", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe("TOKEN_COOKIE", () => {
    it("is exported as the expected name", () => {
      expect(TOKEN_COOKIE).toBe("chatdocs_token");
    });
  });

  describe("setAuthCookie", () => {
    it("includes the token value and standard attributes", () => {
      const cookie = setAuthCookie("abc.def.ghi");
      expect(cookie).toContain("chatdocs_token=abc.def.ghi");
      expect(cookie).toContain("Path=/");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=Lax");
      expect(cookie).toContain("Max-Age=604800");
    });

    it("omits the Secure flag outside production", () => {
      delete process.env.NODE_ENV;
      expect(setAuthCookie("token")).not.toContain("Secure");
    });

    it("includes the Secure flag in production", () => {
      process.env.NODE_ENV = "production";
      expect(setAuthCookie("token")).toContain("Secure");
    });
  });

  describe("removeAuthCookie", () => {
    it("returns a cookie header that immediately expires the token", () => {
      const cookie = removeAuthCookie();
      expect(cookie).toContain("chatdocs_token");
      expect(cookie).toContain("Path=/");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=Lax");
      expect(cookie).toContain("Max-Age=0");
    });
  });
});
