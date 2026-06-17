import { describe, it, expect, beforeEach, jest } from "@jest/globals";

jest.unstable_mockModule("../../src/lib/openai.js", () => ({
  getOpenAIClient: jest.fn(),
}));

let embedText: typeof import("../../src/lib/embeddings.js")["embedText"];
let embedTexts: typeof import("../../src/lib/embeddings.js")["embedTexts"];
let mockCreate: jest.Mock;
let mockGetOpenAIClient: jest.Mock;

beforeEach(async () => {
  jest.resetModules();
  mockCreate = jest.fn();
  mockGetOpenAIClient = jest.fn(() => ({ embeddings: { create: mockCreate } }));

  jest.unstable_mockModule("../../src/lib/openai.js", () => ({
    getOpenAIClient: mockGetOpenAIClient,
  }));

  const mod = await import("../../src/lib/embeddings.js");
  embedText = mod.embedText;
  embedTexts = mod.embedTexts;
});

describe("embedText", () => {
  it("returns the embedding vector from the OpenAI response", async () => {
    const vector = [0.1, 0.2, 0.3];
    mockCreate.mockResolvedValue({ data: [{ embedding: vector }] });

    const result = await embedText("hello world");
    expect(mockGetOpenAIClient).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({
      model: expect.any(String),
      input: "hello world",
    });
    expect(result).toEqual(vector);
  });
});

describe("embedTexts", () => {
  it("returns an empty array for empty input without calling the API", async () => {
    const result = await embedTexts([]);
    expect(result).toEqual([]);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns embeddings sorted by their original index", async () => {
    const vec1 = [0.1, 0.1];
    const vec2 = [0.2, 0.2];
    const vec3 = [0.3, 0.3];

    mockCreate.mockResolvedValue({
      data: [
        { index: 2, embedding: vec3 },
        { index: 0, embedding: vec1 },
        { index: 1, embedding: vec2 },
      ],
    });

    const result = await embedTexts(["a", "b", "c"]);
    expect(result).toEqual([vec1, vec2, vec3]);
  });

  it("passes the input array directly to the API", async () => {
    mockCreate.mockResolvedValue({ data: [] });
    await embedTexts(["x", "y"]);
    expect(mockCreate).toHaveBeenCalledWith({
      model: expect.any(String),
      input: ["x", "y"],
    });
  });
});
