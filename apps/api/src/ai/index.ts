import { createEmbeddingProvider } from "./embeddings.js";
import { createLLMProvider } from "./llm.js";

/** Punto único donde se eligen los proveedores (según el `.env`). */
export const embeddings = createEmbeddingProvider();
export const llm = createLLMProvider();

export const providerInfo = () => ({
  llm: { provider: llm.provider, model: llm.model },
  embeddings: { provider: embeddings.provider, model: embeddings.model, dimensions: embeddings.dimensions },
  demo: llm.provider === "mock",
});

export { complete } from "./types.js";
export type * from "./types.js";
