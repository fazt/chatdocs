import Anthropic from "@anthropic-ai/sdk";
import { env, isTest } from "../config/env.js";
import { failedDependency } from "../lib/errors.js";
import { estimateTokens, foldForMatch, normalizeText, truncate } from "../lib/text.js";
import type { ContextItem, LLMEvent, LLMProvider, LLMRequest } from "./types.js";

// --- Anthropic (por defecto si hay ANTHROPIC_API_KEY) -------------------------------

const REFUSAL_TEXT = "\n\nNo puedo ayudar con esa petición.";

function anthropicProvider(): LLMProvider {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const model = env.ANTHROPIC_MODEL;
  const supportsFallbacks = /opus-5|fable|sonnet-5-5/.test(model);

  return {
    provider: "anthropic",
    model,
    async *stream(request: LLMRequest): AsyncGenerator<LLMEvent> {
      const messages: Anthropic.Beta.BetaMessageParam[] = request.history.map((turn) => ({ role: turn.role, content: turn.content }));
      // Prompt caching: system fijo + historial forman el prefijo cacheado; el
      // contexto recuperado y la pregunta van al final.
      const last = messages.at(-1);
      if (last && typeof last.content === "string") {
        last.content = [{ type: "text", text: last.content, cache_control: { type: "ephemeral" } }];
      }
      messages.push({ role: "user", content: request.userContent });

      const stream = client.beta.messages.stream(
        {
          model,
          max_tokens: request.maxTokens ?? env.LLM_MAX_TOKENS,
          system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
          messages,
          thinking: { type: "adaptive" },
          output_config: { effort: env.ANTHROPIC_EFFORT },
          ...(supportsFallbacks && env.ANTHROPIC_FALLBACKS
            ? { fallbacks: "default" as const, betas: ["server-side-fallback-2026-07-01"] }
            : {}),
        },
        request.signal ? { signal: request.signal } : undefined,
      );

      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            yield { type: "text", text: event.delta.text };
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") yield { type: "text", text: REFUSAL_TEXT };
        yield {
          type: "done",
          model: final.model,
          stopReason: final.stop_reason,
          usage: { inputTokens: final.usage.input_tokens, outputTokens: final.usage.output_tokens },
        };
      } catch (error) {
        if (request.signal?.aborted) return;
        if (error instanceof Anthropic.RateLimitError) throw failedDependency("Anthropic: límite de peticiones alcanzado, reintenta en unos segundos");
        if (error instanceof Anthropic.AuthenticationError) throw failedDependency("Anthropic: la API key no es válida");
        if (error instanceof Anthropic.APIError) throw failedDependency(`Anthropic respondió ${error.status ?? "con un error"}`);
        throw error;
      }
    },
  };
}

// --- OpenAI y compatibles (Ollama, vLLM, LM Studio…) por REST ------------------------

function openAiProvider(): LLMProvider {
  const model = env.OPENAI_CHAT_MODEL;
  return {
    provider: "openai",
    model,
    async *stream(request: LLMRequest): AsyncGenerator<LLMEvent> {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (env.OPENAI_API_KEY) headers["Authorization"] = `Bearer ${env.OPENAI_API_KEY}`;
      let response: Response;
      try {
        response = await fetch(`${env.OPENAI_BASE_URL}/chat/completions`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model,
            stream: true,
            stream_options: { include_usage: true },
            temperature: 0.1,
            max_tokens: request.maxTokens ?? env.LLM_MAX_TOKENS,
            messages: [{ role: "system", content: request.system }, ...request.history, { role: "user", content: request.userContent }],
          }),
          ...(request.signal ? { signal: request.signal } : {}),
        });
      } catch (error) {
        if (request.signal?.aborted) return;
        throw failedDependency(`No se pudo contactar con ${env.OPENAI_BASE_URL}: ${(error as Error).message}`);
      }
      if (!response.ok || !response.body) {
        const detail = (await response.text().catch(() => "")).slice(0, 200);
        throw failedDependency(`El proveedor de chat respondió ${response.status}${detail ? `: ${detail}` : ""}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let output = "";
      let usage = { inputTokens: 0, outputTokens: 0 };
      let stopReason: string | null = null;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === "[DONE]") continue;
            try {
              const chunk = JSON.parse(payload) as {
                choices?: { delta?: { content?: string }; finish_reason?: string | null }[];
                usage?: { prompt_tokens?: number; completion_tokens?: number };
              };
              const delta = chunk.choices?.[0]?.delta?.content;
              if (delta) {
                output += delta;
                yield { type: "text", text: delta };
              }
              stopReason = chunk.choices?.[0]?.finish_reason ?? stopReason;
              if (chunk.usage) usage = { inputTokens: chunk.usage.prompt_tokens ?? 0, outputTokens: chunk.usage.completion_tokens ?? 0 };
            } catch {
              // keep-alive o línea incompleta
            }
          }
        }
      } catch (error) {
        if (request.signal?.aborted) return;
        throw error;
      } finally {
        await reader.cancel().catch(() => undefined);
      }
      if (usage.inputTokens === 0) {
        usage = { inputTokens: estimateTokens(request.system + request.userContent), outputTokens: estimateTokens(output) };
      }
      yield { type: "done", usage, model, stopReason };
    },
  };
}

// --- mock: extractivo y determinista (demo sin claves y tests) -----------------------

const WORD = /[\p{L}\p{N}]{3,}/gu;

const sentencesOf = (content: string): string[] =>
  normalizeText(content)
    .replace(/^#{1,6}\s+.*$/gm, "")
    .replace(/\n+/g, " ")
    .split(/(?<=[.;:!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25);

interface Picked {
  item: ContextItem;
  text: string;
  score: number;
}

/** Frases del contexto más parecidas a la pregunta, ponderadas por rareza (IDF). */
export function pickSentences(question: string, context: ContextItem[], max: number, perItem = 2): Picked[] {
  const all = context.flatMap((item) => sentencesOf(item.content).map((text) => ({ item, text })));
  const df = new Map<string, number>();
  for (const { text } of all) for (const w of new Set(foldForMatch(text).match(WORD) ?? [])) df.set(w, (df.get(w) ?? 0) + 1);
  const q = new Set(foldForMatch(question).match(WORD) ?? []);
  const scored = all
    .map(({ item, text }) => {
      let score = 0;
      for (const w of new Set(foldForMatch(text).match(WORD) ?? [])) if (q.has(w)) score += Math.log(1 + all.length / (df.get(w) ?? 1));
      return { item, text, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  const perCount = new Map<number, number>();
  const picked: Picked[] = [];
  for (const s of scored) {
    const used = perCount.get(s.item.n) ?? 0;
    if (used >= perItem) continue;
    perCount.set(s.item.n, used + 1);
    picked.push(s);
    if (picked.length >= max) break;
  }
  return picked;
}

/** Las citas del mock son literales (truncadas en un límite de frase) para que se verifiquen. */
const quoteOf = (text: string) => (text.length > 240 ? text.slice(0, text.lastIndexOf(" ", 240)) : text);

export function buildMockAnswer(request: LLMRequest): string {
  const { question, context, task } = request;
  if (task === "extract") {
    const [best] = pickSentences(question, context, 1, 1);
    if (!best) return JSON.stringify({ found: false, value: "No consta en el documento", quote: null, source: null });
    const quote = quoteOf(best.text);
    return JSON.stringify({ found: true, value: truncate(best.text, 180), quote, source: best.item.n });
  }
  if (context.length === 0) return "No encontré información sobre eso en los documentos seleccionados.";

  if (task === "compare") {
    const byDoc = new Map<string, Picked[]>();
    for (const p of pickSentences(question, context, 12, 1)) {
      const list = byDoc.get(p.item.documentTitle) ?? [];
      list.push(p);
      byDoc.set(p.item.documentTitle, list);
    }
    if (byDoc.size === 0) return "No encontré pasajes comparables en los documentos seleccionados.";
    const lines = ["Comparación de lo que dice cada documento:", "", "| Documento | Lo que establece |", "| --- | --- |"];
    for (const [title, picks] of byDoc) {
      const p = picks[0]!;
      lines.push(`| ${title.replace(/\|/g, "/")} | «${quoteOf(p.text).replace(/\|/g, "/")}» [${p.item.n}] |`);
    }
    lines.push("", "_Respuesta generada en modo demo (sin modelo de IA): son extractos literales de los documentos._");
    return lines.join("\n");
  }

  const picked = pickSentences(question, context, 3);
  if (picked.length === 0) return "No encontré información sobre eso en los documentos seleccionados.";
  const lines = ["Según los documentos:", ""];
  for (const p of picked) lines.push(`- «${quoteOf(p.text)}» [${p.item.n}]`);
  lines.push("", "_Respuesta generada en modo demo (sin modelo de IA): son extractos literales de los documentos._");
  return lines.join("\n");
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (ms <= 0) return resolve();
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });

function mockProvider(): LLMProvider {
  const delay = isTest ? 0 : 15;
  return {
    provider: "mock",
    model: "mock-extractivo-v1",
    async *stream(request: LLMRequest): AsyncGenerator<LLMEvent> {
      const answer = buildMockAnswer(request);
      const pieces = request.task === "extract" ? [answer] : (answer.match(/\S+\s*/g) ?? [answer]);
      for (const piece of pieces) {
        if (request.signal?.aborted) return;
        yield { type: "text", text: piece };
        await sleep(delay, request.signal);
      }
      yield {
        type: "done",
        model: "mock-extractivo-v1",
        stopReason: "end_turn",
        usage: { inputTokens: estimateTokens(request.system + request.userContent), outputTokens: estimateTokens(answer) },
      };
    },
  };
}

export function createLLMProvider(): LLMProvider {
  const kind =
    env.LLM_PROVIDER === "auto" ? (env.ANTHROPIC_API_KEY ? "anthropic" : env.OPENAI_API_KEY ? "openai" : "mock") : env.LLM_PROVIDER;
  switch (kind) {
    case "anthropic":
      return anthropicProvider();
    case "openai":
      return openAiProvider();
    default:
      return mockProvider();
  }
}
