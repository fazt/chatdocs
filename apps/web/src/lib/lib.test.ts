import { describe, expect, it } from "vitest";
import { readSse } from "./api";
import { formatMoney, locationLabel } from "./format";
import { safeNext } from "./safe-next";

function streamOf(chunks: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
  );
}

describe("readSse", () => {
  it("reconstruye eventos partidos entre lecturas", async () => {
    const res = streamOf(['event: delta\ndata: {"te', 'xt":"Hola"}\n\nevent: done\n', 'data: {"ok":true}\n\n']);
    const events = [];
    for await (const e of readSse(res)) events.push(e);
    expect(events).toEqual([
      { event: "delta", data: '{"text":"Hola"}' },
      { event: "done", data: '{"ok":true}' },
    ]);
  });
});

describe("safeNext", () => {
  it("solo acepta rutas internas", () => {
    expect(safeNext("/app/x")).toBe("/app/x");
    expect(safeNext("//evil.com")).toBe("/app");
    expect(safeNext("https://evil.com")).toBe("/app");
    expect(safeNext("/\\evil.com")).toBe("/app");
  });
});

describe("formato", () => {
  it("ubicaciones por tipo de documento", () => {
    expect(locationLabel("pdf", 12)).toBe("pág. 12");
    expect(locationLabel("markdown", 3, "Plazo")).toBe("secc. 3 · Plazo");
  });
  it("monedas", () => {
    expect(formatMoney(1900, "USD")).toContain("19");
  });
});
