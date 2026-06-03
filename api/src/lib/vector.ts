export interface ChunkResult {
  id: string;
  content: string;
  heading: string;
  chunkIndex: number;
  tokenCount: number;
  documentId: string;
}

export interface ScoredChunk extends ChunkResult {
  score: number;
}

export interface SourceInfo {
  chunkId: string;
  documentName: string;
  heading: string;
  score: number;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  return magnitude === 0 ? 0 : dot / magnitude;
}

export function parseEmbedding(embedding: string): number[] {
  return JSON.parse(embedding) as number[];
}

export function topK(
  queryEmbedding: number[],
  chunks: { id: string; content: string; embedding: string; heading: string; documentId: string; chunkIndex: number; tokenCount: number }[],
  k: number = 5
): ScoredChunk[] {
  const scored = chunks.map((chunk) => ({
    id: chunk.id,
    content: chunk.content,
    heading: chunk.heading,
    chunkIndex: chunk.chunkIndex,
    tokenCount: chunk.tokenCount,
    documentId: chunk.documentId,
    score: cosineSimilarity(queryEmbedding, parseEmbedding(chunk.embedding)),
  }));

  return scored.sort((a, b) => b.score - a.score).slice(0, k);
}
