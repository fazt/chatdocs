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

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources?: SourceInfo[];
  tokenCount: number;
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
  documentCount?: number;
}

export interface Document {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StreamEvent {
  type: "delta" | "done" | "error";
  content?: string;
  sources?: SourceInfo[];
  messageId?: string;
  message?: string;
}
