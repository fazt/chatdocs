import { getOpenAIClient } from "./openai.js";
import { MODEL } from "./constants.js";
import type { SourceInfo } from "./vector.js";

export function buildSystemPrompt(
  chunks: { content: string; heading: string; documentName: string }[]
): string {
  const contextBlocks = chunks
    .map(
      (c, i) =>
        `---BEGIN CHUNK ${i + 1}---\n[Source: "${c.documentName}"${
          c.heading ? ` — Section: "${c.heading}"` : ""
        }]\n${c.content}\n---END CHUNK ${i + 1}---`
    )
    .join("\n\n");

  return `You are a helpful assistant answering questions based on provided documents and images. Answer concisely and cite the source document name and section heading when referencing specific information. If the documents don't contain enough information to answer the question, say so clearly.

Context from documents:
${contextBlocks}`;
}

export async function* streamChatCompletion(
  systemPrompt: string,
  messages: { role: "user" | "assistant" | "system"; content: string | any[] }[],
  signal?: AbortSignal
): AsyncGenerator<string, void, unknown> {
  const openai = getOpenAIClient();

  const stream = await openai.chat.completions.create(
    {
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      stream: true,
    },
    { signal }
  );

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      yield delta;
    }
  }
}

export function buildSources(
  chunks: { id: string; heading: string; documentName: string; score: number }[]
): SourceInfo[] {
  return chunks.map((c) => ({
    chunkId: c.id,
    documentName: c.documentName,
    heading: c.heading,
    score: c.score,
  }));
}
