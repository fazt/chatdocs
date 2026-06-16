import { describe, it, expect } from "@jest/globals";
import { uuid, now } from "../../src/lib/utils.js";

describe("utils", () => {
  describe("uuid", () => {
    it("should return a string", () => {
      const id = uuid();
      expect(typeof id).toBe("string");
    });

    it("should return a UUID v4 format", () => {
      const id = uuid();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
    });

    it("should return unique values", () => {
      const ids = new Set(Array.from({ length: 100 }, () => uuid()));
      expect(ids.size).toBe(100);
    });
  });

  describe("now", () => {
    it("should return an ISO 8601 string", () => {
      const timestamp = now();
      expect(() => new Date(timestamp)).not.toThrow();
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });
  });
});
