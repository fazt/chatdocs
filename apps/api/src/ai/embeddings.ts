import { EMBEDDING_DIMENSIONS, env } from "../config/env.js";
import { failedDependency } from "../lib/errors.js";
import type { EmbeddingProvider } from "./types.js";

const BATCH = 64;

// --- mock: determinista y sin red (demo sin claves y tests) ----------------------

/** FNV-1a de 32 bits. */
function hash32(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

const STOP = new Set(
  "de la el en y a los las del un una que es por con para se al lo como su sus o mas no si sin sobre entre ante the of and to in is for on with as are be this that it or by an at from".split(" "),
);

export function tokenize(text: string): string[] {
  const folded = text.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  return (folded.match(/[\p{L}\p{N}]+/gu) ?? []).filter((w) => w.length > 1 && !STOP.has(w));
}

/**
 * Embedding por hashing: palabras + trigramas proyectados y normalizados.
 * Textos parecidos comparten casillas, así que la similitud coseno funciona de
 * verdad en la demo y en los tests (no es semántica, pero es estable).
 */
export function mockEmbedding(text: string, dimensions = EMBEDDING_DIMENSIONS): number[] {
  const vector = new Array<number>(dimensions).fill(0);
  const words = tokenize(text);
  for (const word of words) {
    const h = hash32(word) % dimensions;
    vector[h] = (vector[h] ?? 0) + 1;
    const padded = `^${word}$`;
    for (let i = 0; i + 3 <= padded.length; i++) {
      const g = hash32(padded.slice(i, i + 3)) % dimensions;
      vector[g] = (vector[g] ?? 0) + 0.3;
    }
  }
  if (words.length === 0) vector[0] = 1;
  const norm = Math.sqrt(vector.reduce((acc, v) => acc + v * v, 0)) || 1;
  return vector.map((v) => v / norm);
}

function mockProvider(): EmbeddingProvider {
  return {
    provider: "mock",
    model: "mock-hash-v1",
    dimensions: EMBEDDING_DIMENSIONS,
    async embed(texts) {
      return texts.map((t) => mockEmbedding(t));
    },
  };
}

// --- OpenAI y compatibles (API REST /embeddings) ---------------------------------

function openAiProvider(): EmbeddingProvider {
  const model = env.EMBEDDING_MODEL;
  // Solo los text-embedding-3-* aceptan `dimensions`; el resto debe devolver 1536.
  const supportsDims = /text-embedding-3/.test(model);
  return {
    provider: "openai",
    model,
    dimensions: EMBEDDING_DIMENSIONS,
    async embed(texts) {
      const vectors: number[][] = [];
      for (let i = 0; i < texts.length; i += BATCH) {
        const batch = texts.slice(i, i + BATCH);
        let response: Response;
        try {
          response = await fetch(`${env.OPENAI_BASE_URL}/embeddings`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(env.OPENAI_API_KEY ? { Authorization: `Bearer ${env.OPENAI_API_KEY}` } : {}),
            },
            body: JSON.stringify({ model, input: batch, ...(supportsDims ? { dimensions: EMBEDDING_DIMENSIONS } : {}) }),
          });
        } catch {
          throw failedDependency("No se pudo contactar con el proveedor de embeddings");
        }
        if (!response.ok) {
          const detail = (await response.text().catch(() => "")).slice(0, 200);
          throw failedDependency(`El proveedor de embeddings respondió ${response.status}${detail ? `: ${detail}` : ""}`);
        }
        const json = (await response.json()) as { data: { index: number; embedding: number[] }[] };
        const sorted = [...json.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
        if (sorted.length !== batch.length) throw failedDependency("El proveedor devolvió un número de vectores distinto");
        if (sorted[0] && sorted[0].length !== EMBEDDING_DIMENSIONS) {
          throw failedDependency(`El modelo ${model} devuelve ${sorted[0].length} dimensiones; Folio usa ${EMBEDDING_DIMENSIONS}`);
        }
        vectors.push(...sorted);
      }
      return vectors;
    },
  };
}

export function createEmbeddingProvider(): EmbeddingProvider {
  const kind = env.EMBEDDING_PROVIDER === "auto" ? (env.OPENAI_API_KEY ? "openai" : "mock") : env.EMBEDDING_PROVIDER;
  return kind === "openai" ? openAiProvider() : mockProvider();
}
