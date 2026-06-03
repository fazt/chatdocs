import { CHUNK_MAX_TOKENS, CHUNK_OVERLAP_TOKENS } from "./constants.js";
import { uuid } from "./utils.js";

export interface RawChunk {
  id: string;
  content: string;
  heading: string;
  chunkIndex: number;
  tokenCount: number;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function chunkMarkdown(text: string, options?: {
  maxChunkSize?: number;
  overlapSize?: number;
}): RawChunk[] {
  const maxChunkSize = options?.maxChunkSize ?? CHUNK_MAX_TOKENS;
  const overlapSize = options?.overlapSize ?? CHUNK_OVERLAP_TOKENS;

  const normalized = text.replace(/\r\n/g, "\n");

  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const sections: { heading: string; content: string }[] = [];

  let lastIndex = 0;
  let lastHeading = "";
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(normalized)) !== null) {
    if (match.index > lastIndex) {
      const content = normalized.slice(lastIndex, match.index).trim();
      if (content) {
        sections.push({ heading: lastHeading, content });
      }
    }
    lastHeading = match[2].trim();
    lastIndex = match.index;
  }

  const remaining = normalized.slice(lastIndex).trim();
  if (remaining) {
    sections.push({ heading: lastHeading, content: remaining });
  }

  if (sections.length === 0 && normalized.trim()) {
    sections.push({ heading: "", content: normalized.trim() });
  }

  const chunks: RawChunk[] = [];
  let chunkIndex = 0;

  for (const section of sections) {
    const sectionTokens = estimateTokens(section.content);

    if (sectionTokens <= maxChunkSize) {
      chunks.push({
        id: uuid(),
        content: section.content,
        heading: section.heading,
        chunkIndex: chunkIndex++,
        tokenCount: sectionTokens,
      });
      continue;
    }

    const paragraphs = section.content.split(/\n\s*\n/);
    let currentChunk = "";
    let currentTokens = 0;

    for (const para of paragraphs) {
      const paraTokens = estimateTokens(para.trim());
      if (!para.trim()) continue;

      if (currentTokens + paraTokens > maxChunkSize && currentChunk) {
        chunks.push({
          id: uuid(),
          content: currentChunk.trim(),
          heading: section.heading,
          chunkIndex: chunkIndex++,
          tokenCount: currentTokens,
        });

        const overlapChars = overlapSize * 4;
        currentChunk =
          currentChunk.length > overlapChars
            ? currentChunk.slice(-overlapChars)
            : currentChunk;
        currentTokens = estimateTokens(currentChunk);
      }

      currentChunk += (currentChunk ? "\n\n" : "") + para.trim();
      currentTokens = estimateTokens(currentChunk);
    }

    if (currentChunk.trim()) {
      chunks.push({
        id: uuid(),
        content: currentChunk.trim(),
        heading: section.heading,
        chunkIndex: chunkIndex++,
        tokenCount: currentTokens,
      });
    }
  }

  return chunks;
}
