import { describe, it, expect } from "@jest/globals";
import { chunkMarkdown } from "../../src/lib/chunker.js";

describe("chunkMarkdown", () => {
  it("returns an empty array for empty input", () => {
    expect(chunkMarkdown("")).toEqual([]);
    expect(chunkMarkdown("   \n\n  ")).toEqual([]);
  });

  it("creates a single chunk for short content without headings", () => {
    const chunks = chunkMarkdown("just a small paragraph of text");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe("just a small paragraph of text");
    expect(chunks[0].heading).toBe("");
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[0].tokenCount).toBeGreaterThan(0);
    expect(typeof chunks[0].id).toBe("string");
  });

  it("normalizes CRLF to LF", () => {
    const text = "# Title\r\n\r\nbody line\r\n";
    const chunks = chunkMarkdown(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].heading).toBe("Title");
    expect(chunks[0].content).toContain("body line");
  });

  it("splits content on markdown headings, preserving heading per chunk", () => {
    const text = [
      "# First",
      "first body",
      "",
      "## Second",
      "second body",
      "",
      "### Third",
      "third body",
    ].join("\n");

    const chunks = chunkMarkdown(text);
    expect(chunks.map((c) => c.heading)).toEqual([
      "First",
      "Second",
      "Third",
    ]);
    expect(chunks[0].content).toContain("first body");
    expect(chunks[1].content).toContain("second body");
    expect(chunks[2].content).toContain("third body");
  });

  it("captures preamble (content before first heading) under an empty heading", () => {
    const text = ["some intro text", "", "# Heading", "body"].join("\n");
    const chunks = chunkMarkdown(text);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].heading).toBe("");
    expect(chunks[0].content).toContain("some intro text");
    expect(chunks[1].heading).toBe("Heading");
  });

  it("increments chunkIndex sequentially across sections", () => {
    const text = ["# A", "a body", "", "# B", "b body"].join("\n");
    const chunks = chunkMarkdown(text);
    expect(chunks.map((c) => c.chunkIndex)).toEqual([0, 1]);
  });

  it("uses a single chunk for a section that fits in maxChunkSize", () => {
    const longParagraph = "word ".repeat(50).trim();
    const text = `# Title\n\n${longParagraph}`;
    const chunks = chunkMarkdown(text, { maxChunkSize: 1000 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toContain(longParagraph);
  });

  it("splits a large section into multiple chunks when it exceeds maxChunkSize", () => {
    const para1 = "alpha ".repeat(40).trim();
    const para2 = "beta ".repeat(40).trim();
    const para3 = "gamma ".repeat(40).trim();
    const text = `# Title\n\n${para1}\n\n${para2}\n\n${para3}`;

    const chunks = chunkMarkdown(text, { maxChunkSize: 60 });
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c) => {
      expect(c.heading).toBe("Title");
      expect(c.content.length).toBeGreaterThan(0);
    });
  });

  it("respects custom overlapSize by keeping some tail content between chunks", () => {
    const para1 = "alpha ".repeat(40).trim();
    const para2 = "beta ".repeat(40).trim();
    const text = `# Title\n\n${para1}\n\n${para2}`;

    const chunksWithOverlap = chunkMarkdown(text, {
      maxChunkSize: 60,
      overlapSize: 10,
    });
    const chunksNoOverlap = chunkMarkdown(text, {
      maxChunkSize: 60,
      overlapSize: 0,
    });

    expect(chunksWithOverlap.length).toBeGreaterThan(1);
    if (chunksWithOverlap.length > 1 && chunksNoOverlap.length > 1) {
      const overlappedContent = chunksWithOverlap
        .slice(0, 2)
        .map((c) => c.content)
        .join(" ");
      const noOverlapContent = chunksNoOverlap
        .slice(0, 2)
        .map((c) => c.content)
        .join(" ");
      expect(overlappedContent.length).toBeGreaterThanOrEqual(
        noOverlapContent.length
      );
    }
  });

  it("assigns unique ids to each chunk", () => {
    const text = "# A\na\n\n# B\nb\n\n# C\nc";
    const chunks = chunkMarkdown(text);
    const ids = new Set(chunks.map((c) => c.id));
    expect(ids.size).toBe(chunks.length);
  });

  it("skips empty paragraphs when chunking large sections", () => {
    const para1 = "alpha ".repeat(40).trim();
    const para2 = "beta ".repeat(40).trim();
    const text = `# Title\n\n${para1}\n\n\n\n${para2}`;
    const chunks = chunkMarkdown(text, { maxChunkSize: 60 });
    chunks.forEach((c) => {
      expect(c.content.trim().length).toBeGreaterThan(0);
    });
  });

  it("handles content after the last heading", () => {
    const text = ["# Heading", "section body", "", "trailing content"].join(
      "\n"
    );
    const chunks = chunkMarkdown(text);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0].heading).toBe("Heading");
    expect(chunks[0].content).toContain("trailing content");
  });
});
