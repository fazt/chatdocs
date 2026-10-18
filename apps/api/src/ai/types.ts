/**
 * Contratos de los proveedores de IA. El resto de la app nunca habla con un SDK
 * directamente: pide vectores a `EmbeddingProvider` y texto a `LLMProvider`.
 * Cuál se usa lo decide `ai/index.ts` según el `.env`.
 */

export interface EmbeddingProvider {
  readonly provider: "openai" | "mock";
  readonly model: string;
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}

/** Fragmento recuperado tal y como lo ve el modelo. */
export interface ContextItem {
  /** 1-based: el número de la cita [n]. */
  n: number;
  documentTitle: string;
  /** "pág. 12" o "sección 3 — Confidencialidad". */
  location: string;
  content: string;
}

export interface HistoryTurn {
  role: "user" | "assistant";
  content: string;
}

export interface LLMRequest {
  /** Instrucciones fijas (cacheables). */
  system: string;
  /** Turnos anteriores en texto plano (sin el contexto recuperado). */
  history: HistoryTurn[];
  /** Mensaje final: contexto delimitado + pregunta. */
  userContent: string;
  /** Para el proveedor mock, que responde extrayendo frases del contexto. */
  question: string;
  context: ContextItem[];
  /** Cómo debe responder el mock: chat, comparación o extracción en JSON. */
  task: "answer" | "compare" | "extract";
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
}

export type LLMEvent = { type: "text"; text: string } | { type: "done"; usage: LLMUsage; model: string; stopReason: string | null };

export interface LLMProvider {
  readonly provider: "anthropic" | "openai" | "mock";
  readonly model: string;
  stream(request: LLMRequest): AsyncGenerator<LLMEvent, void, unknown>;
}

/** Recoge el stream completo (extracciones, títulos). */
export async function complete(llm: LLMProvider, request: LLMRequest): Promise<{ text: string; usage: LLMUsage; model: string }> {
  let text = "";
  let usage: LLMUsage = { inputTokens: 0, outputTokens: 0 };
  let model = llm.model;
  for await (const event of llm.stream(request)) {
    if (event.type === "text") text += event.text;
    else {
      usage = event.usage;
      model = event.model;
    }
  }
  return { text, usage, model };
}
