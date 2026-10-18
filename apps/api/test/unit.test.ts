import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { mockEmbedding } from "../src/ai/embeddings.js";
import { buildMockAnswer } from "../src/ai/llm.js";
import { StripeProvider } from "../src/billing/providers/stripe.js";
import { WebhookSignatureError } from "../src/billing/providers/types.js";
import { effectivePlan } from "../src/config/plans.js";
import { convertCents, toMajorUnits } from "../src/lib/money.js";
import { RateLimiter } from "../src/lib/rate-limit.js";
import { contentDisposition, foldForMatch, normalizeText } from "../src/lib/text.js";
import { chunkPages } from "../src/rag/chunker.js";
import { citedNumbers, extractQuotes, quoteAppearsIn } from "../src/rag/citations.js";
import { parseExtractionOutput } from "../src/rag/extraction.js";
import { detectKind, splitByHeadings } from "../src/rag/extract.js";

describe("texto", () => {
  it("une palabras cortadas por guion al final de línea", () => {
    expect(normalizeText("las obliga-\nciones del arrendatario")).toBe("las obligaciones del arrendatario");
  });
  it("compara sin tildes, mayúsculas ni comillas tipográficas", () => {
    expect(foldForMatch("«OBLIGACIÓN»  de\npago")).toBe('"obligacion" de pago');
  });
  it("Content-Disposition seguro con tildes", () => {
    expect(contentDisposition('Contrato "Miraflores".pdf')).toContain("filename*=UTF-8''Contrato%20Miraflores%20.pdf");
  });
});

describe("extracción", () => {
  it("detecta el tipo por el contenido y no por la extensión", () => {
    expect(detectKind(Buffer.from("%PDF-1.7 ..."), "a.pdf")).toBe("pdf");
    expect(() => detectKind(Buffer.from("%PDF-1.7"), "a.txt")).toThrow();
    expect(() => detectKind(Buffer.from([0x4d, 0x5a, 0, 0, 1]), "a.md")).toThrow();
    expect(detectKind(Buffer.from("# Hola"), "nota.md")).toBe("markdown");
  });
  it("parte Markdown por encabezados e ignora # dentro de bloques de código", () => {
    const pages = splitByHeadings("# Uno\ntexto\n```\n# no\n```\n## Dos\nmás");
    expect(pages.map((p) => p.heading)).toEqual(["Uno", "Dos"]);
    expect(pages[1]!.number).toBe(2);
  });
});

describe("chunker", () => {
  it("nunca mezcla páginas y conserva la posición en la página", () => {
    const pages = [
      { number: 1, heading: null, text: "Párrafo uno.\n\nPárrafo dos." },
      { number: 2, heading: null, text: "Página dos." },
    ];
    const chunks = chunkPages(pages, { maxChars: 2000, overlapChars: 0 });
    expect(chunks).toHaveLength(2);
    expect(chunks[1]!.page).toBe(2);
    expect(pages[0]!.text.slice(chunks[0]!.charStart)).toContain(chunks[0]!.content.slice(0, 10));
  });
  it("corta páginas largas con solapamiento y siempre avanza", () => {
    const text = Array.from({ length: 40 }, (_, i) => `Párrafo número ${i} con algo de contenido para llenar.`).join("\n\n");
    const chunks = chunkPages([{ number: 1, heading: null, text }], { maxChars: 400, overlapChars: 120 });
    expect(chunks.length).toBeGreaterThan(5);
    expect(chunks.every((c) => c.content.length <= 400)).toBe(true);
    expect(chunks.at(-1)!.content).toContain("Párrafo número 39");
  });
});

describe("citas", () => {
  const answer = "El preaviso es de 90 días: «con una anticipación no menor de noventa días calendario» [2]. Ver también [1, 3].";
  it("detecta referencias y citas literales", () => {
    expect([...citedNumbers(answer)].sort()).toEqual([1, 2, 3]);
    expect(extractQuotes(answer)).toEqual([{ text: "con una anticipación no menor de noventa días calendario", n: 2 }]);
  });
  it("verifica la cita contra el texto (tolerante a tildes, saltos y omisiones …)", () => {
    const page = "comunique su voluntad de no renovarlo con una ANTICIPACION no menor de\nnoventa dias calendario a la fecha";
    expect(quoteAppearsIn("con una anticipación no menor de noventa días calendario", page)).toBe(true);
    expect(quoteAppearsIn("no renovarlo … noventa días calendario", page)).toBe(true);
    expect(quoteAppearsIn("con una anticipación no menor de treinta días", page)).toBe(false);
  });
});

describe("modo demo (mock)", () => {
  it("responde con citas literales que se pueden verificar", () => {
    const content = "El arrendatario pagará una penalidad equivalente a dos meses de renta si resuelve antes del plazo.";
    const answer = buildMockAnswer({
      system: "",
      history: [],
      userContent: "",
      question: "¿Qué penalidad hay si se resuelve antes?",
      context: [{ n: 1, documentTitle: "Contrato", location: "sección 1", content }],
      task: "answer",
    });
    const [quote] = extractQuotes(answer);
    expect(quote?.n).toBe(1);
    expect(quoteAppearsIn(quote!.text, content)).toBe(true);
  });
  it("los embeddings mock son deterministas y normalizados", () => {
    const a = mockEmbedding("penalidad por resolución anticipada");
    expect(a).toEqual(mockEmbedding("penalidad por resolución anticipada"));
    expect(Math.hypot(...a)).toBeCloseTo(1, 5);
  });
});

describe("extracciones", () => {
  it("parsea JSON con texto alrededor y casos sin dato", () => {
    expect(parseExtractionOutput('```json\n{"found":true,"value":"3 años","quote":"El plazo es de tres años","source":2}\n```')).toMatchObject({
      found: true,
      value: "3 años",
      source: 2,
    });
    expect(parseExtractionOutput("sin json").found).toBe(false);
    expect(parseExtractionOutput('{"found":false,"value":null}').value).toBe("No consta en el documento");
  });
});

describe("dinero, planes y límites", () => {
  it("convierte centavos sin sumar monedas", () => {
    expect(toMajorUnits(1900, "USD")).toBe("19.00");
    expect(toMajorUnits(1500000, "CLP")).toBe("15000");
    expect(convertCents(1900, 3.75, "PEN")).toBe(7125);
  });
  it("un plan pagado caducado vuelve a Gratis", () => {
    expect(effectivePlan("pro", new Date(Date.now() - 1000))).toBe("free");
    expect(effectivePlan("team", new Date(Date.now() + 60_000))).toBe("team");
  });
  it("el rate limiter bloquea al superar el límite", () => {
    const limiter = new RateLimiter(2, 60_000);
    expect([limiter.consume("ip"), limiter.consume("ip"), limiter.consume("ip")]).toEqual([true, true, false]);
    expect(limiter.isBlocked("ip")).toBe(true);
  });
});

describe("webhook de Stripe", () => {
  const provider = new StripeProvider();
  const body = JSON.stringify({
    id: "evt_1",
    type: "checkout.session.completed",
    data: { object: { id: "cs_1", payment_status: "paid", amount_total: 1900, payment_intent: "pi_1", metadata: { paymentId: "p1" } } },
  });
  const sign = (t: number, payload: string) => createHmac("sha256", "whsec_test_dummy").update(`${t}.${payload}`).digest("hex");

  it("acepta una firma válida sobre el raw body", async () => {
    const t = Math.floor(Date.now() / 1000);
    const event = await provider.parseWebhook({ rawBody: Buffer.from(body), headers: { "stripe-signature": `t=${t},v1=${sign(t, body)}` }, query: {} });
    expect(event).toMatchObject({ type: "paid", paymentId: "p1", amountCents: 1900 });
  });
  it("rechaza firmas inválidas o caducadas", async () => {
    const t = Math.floor(Date.now() / 1000);
    await expect(provider.parseWebhook({ rawBody: Buffer.from(body + " "), headers: { "stripe-signature": `t=${t},v1=${sign(t, body)}` }, query: {} })).rejects.toBeInstanceOf(
      WebhookSignatureError,
    );
    const old = t - 3600;
    await expect(provider.parseWebhook({ rawBody: Buffer.from(body), headers: { "stripe-signature": `t=${old},v1=${sign(old, body)}` }, query: {} })).rejects.toBeInstanceOf(
      WebhookSignatureError,
    );
  });
});
