import { describe, it, expect } from "@jest/globals";
import { config } from "../../src/config.js";

describe("config", () => {
  it("should have the expected shape with defaults", () => {
    expect(config).toMatchObject({
      port: expect.any(Number),
      corsOrigin: expect.any(String),
      jwtSecret: expect.any(String),
      jwtExpiresIn: expect.any(String),
      databaseUrl: expect.any(String),
      openaiModel: expect.any(String),
      openaiEmbeddingModel: expect.any(String),
    });

    expect(config.port).toBe(3001);
    expect(config.corsOrigin).toBe("http://localhost:3000");
    expect(config.jwtExpiresIn).toBe("7d");
  });
});
