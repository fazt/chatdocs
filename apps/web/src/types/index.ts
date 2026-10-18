export type MemberRole = "owner" | "editor" | "viewer";
export type PlanId = "free" | "pro" | "team";
export type DocumentKind = "pdf" | "docx" | "markdown" | "text";

export interface User {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  plan: PlanId;
  role: MemberRole;
}

export interface PlanInfo {
  id: PlanId;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  days: number;
  limits: { members: number; documents: number; pagesPerMonth: number; questionsPerMonth: number; extractionsPerMonth: number };
  features: string[];
}

export interface Usage {
  period: string;
  plan: PlanId;
  limits: PlanInfo["limits"];
  used: { questions: number; pages: number; extractions: number; documents: number; members: number };
}

export interface WorkspaceDetail {
  workspace: { id: string; name: string; plan: PlanId; planExpiresAt: string | null; role: MemberRole };
  usage: Usage;
  planInfo: PlanInfo;
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  kind: "legal" | "compliance" | "research" | "general";
  documentCount: number;
  createdAt: string;
}

export interface DocumentMetadata {
  authors?: string;
  year?: string;
  doi?: string;
  reference?: string;
  parties?: string;
  signedAt?: string;
  notes?: string;
}

export interface DocumentItem {
  id: string;
  collectionId: string;
  title: string;
  originalName: string;
  kind: DocumentKind;
  sizeBytes: number;
  status: "queued" | "processing" | "ready" | "failed";
  error: string | null;
  pageCount: number;
  chunkCount: number;
  metadata: DocumentMetadata;
  createdAt: string;
  updatedAt: string;
  collectionName?: string | null;
}

export interface CitationQuote {
  text: string;
  verified: boolean;
  page: number | null;
}

export interface Citation {
  n: number;
  chunkId: string;
  documentId: string;
  documentTitle: string;
  documentKind: DocumentKind;
  page: number;
  heading: string | null;
  excerpt: string;
  score: number;
  used: boolean;
  quotes: CitationQuote[];
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  status: "complete" | "aborted" | "error";
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  mode: "qa" | "compare";
  collectionId: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface ConversationDetail {
  conversation: Conversation;
  messages: Message[];
  documents: { id: string; title: string; kind: DocumentKind; status: string }[];
}

export interface ExtractionField {
  key: string;
  label: string;
  instructions: string;
}

export interface ExtractionTemplate {
  key: string;
  name: string;
  description: string;
  fields: ExtractionField[];
}
