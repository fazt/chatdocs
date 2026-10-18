import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

/**
 * Esquema de Folio. La migración SQL equivalente (escrita a mano, con índices
 * HNSW/GIN y la columna tsvector generada) está en `drizzle/0000_init.sql`:
 * si cambias algo aquí, añade una migración nueva.
 */

const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector",
});

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const userRole = pgEnum("user_role", ["user", "admin"]);
export const memberRole = pgEnum("member_role", ["owner", "editor", "viewer"]);
export const planId = pgEnum("plan_id", ["free", "pro", "team"]);
export const collectionKind = pgEnum("collection_kind", ["legal", "compliance", "research", "general"]);
export const documentKind = pgEnum("document_kind", ["pdf", "docx", "markdown", "text"]);
export const documentStatus = pgEnum("document_status", ["queued", "processing", "ready", "failed"]);
export const conversationMode = pgEnum("conversation_mode", ["qa", "compare"]);
export const messageRole = pgEnum("message_role", ["user", "assistant"]);
export const messageStatus = pgEnum("message_status", ["complete", "aborted", "error"]);
export const extractionStatus = pgEnum("extraction_status", ["queued", "running", "done", "failed"]);
export const paymentStatus = pgEnum("payment_status", ["pending", "paid", "failed", "refunded"]);

// --- Usuarios y sesiones ---------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Siempre en minúsculas (se normaliza al escribir). */
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: userRole("role").notNull().default("user"),
  disabledAt: ts("disabled_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/** Sesión opaca: la cookie lleva un token aleatorio; aquí solo su SHA-256. */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    userAgent: text("user_agent"),
    ip: text("ip"),
    expiresAt: ts("expires_at").notNull(),
    lastUsedAt: ts("last_used_at").notNull().defaultNow(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const passwordResets = pgTable(
  "password_resets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: ts("expires_at").notNull(),
    usedAt: ts("used_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("password_resets_user_idx").on(t.userId)],
);

// --- Espacios de trabajo (equipos) --------------------------------------------------

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  plan: planId("plan").notNull().default("free"),
  planExpiresAt: ts("plan_expires_at"),
  createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] }), index("workspace_members_user_idx").on(t.userId)],
);

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: memberRole("role").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    invitedById: uuid("invited_by_id").references(() => users.id, { onDelete: "set null" }),
    expiresAt: ts("expires_at").notNull(),
    acceptedAt: ts("accepted_at"),
    revokedAt: ts("revoked_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("invitations_workspace_idx").on(t.workspaceId)],
);

/** Uso mensual por espacio. Los incrementos son atómicos y condicionados al límite. */
export const usageCounters = pgTable(
  "usage_counters",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    period: text("period").notNull(),
    questions: integer("questions").notNull().default(0),
    pages: integer("pages").notNull().default(0),
    extractions: integer("extractions").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.period] })],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    ip: text("ip"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("audit_logs_workspace_created_idx").on(t.workspaceId, t.createdAt)],
);

// --- Expedientes, documentos y fragmentos ---------------------------------------------

export const collections = pgTable(
  "collections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    kind: collectionKind("kind").notNull().default("general"),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("collections_workspace_idx").on(t.workspaceId)],
);

/** Metadatos bibliográficos/legales editables (autores, año, DOI, partes, fecha de firma…). */
export interface DocumentMetadata {
  authors?: string;
  year?: string;
  doi?: string;
  reference?: string;
  parties?: string;
  signedAt?: string;
  notes?: string;
}

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    kind: documentKind("kind").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    storageKey: text("storage_key").notNull(),
    status: documentStatus("status").notNull().default("queued"),
    error: text("error"),
    pageCount: integer("page_count").notNull().default(0),
    chunkCount: integer("chunk_count").notNull().default(0),
    embeddingModel: text("embedding_model"),
    metadata: jsonb("metadata").$type<DocumentMetadata>().notNull().default({}),
    uploadedById: uuid("uploaded_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("documents_workspace_idx").on(t.workspaceId, t.createdAt),
    index("documents_collection_idx").on(t.collectionId),
    index("documents_status_idx").on(t.status),
    // El mismo archivo no se indexa dos veces en un expediente.
    uniqueIndex("documents_collection_sha_idx").on(t.collectionId, t.sha256),
  ],
);

/**
 * Texto por página (PDF) o por sección (DOCX/Markdown/TXT). Es la fuente de
 * verdad para el visor y para verificar que una cita aparece literalmente.
 */
export const documentPages = pgTable(
  "document_pages",
  {
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    pageNumber: integer("page_number").notNull(),
    heading: text("heading"),
    text: text("text").notNull(),
  },
  (t) => [primaryKey({ columns: [t.documentId, t.pageNumber] })],
);

export const chunks = pgTable(
  "chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    page: integer("page").notNull(),
    heading: text("heading"),
    /** Posición del fragmento dentro del texto de su página (para resaltar). */
    charStart: integer("char_start").notNull().default(0),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    tokenCount: integer("token_count").notNull().default(0),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    tsv: tsvector("tsv").generatedAlwaysAs(sql`to_tsvector('simple', coalesce(heading, '') || ' ' || content)`),
  },
  (t) => [
    index("chunks_document_idx").on(t.documentId, t.chunkIndex),
    index("chunks_workspace_idx").on(t.workspaceId),
    index("chunks_embedding_hnsw_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
    index("chunks_tsv_idx").using("gin", t.tsv),
  ],
);

// --- Conversaciones -------------------------------------------------------------------

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    collectionId: uuid("collection_id").references(() => collections.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    title: text("title").notNull().default("Nueva consulta"),
    mode: conversationMode("mode").notNull().default("qa"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("conversations_workspace_idx").on(t.workspaceId, t.updatedAt)],
);

/** Documentos a los que se limita una conversación (vacío = todo el expediente). */
export const conversationDocuments = pgTable(
  "conversation_documents",
  {
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.conversationId, t.documentId] })],
);

export interface CitationQuote {
  text: string;
  /** true si el texto aparece literalmente (normalizado) en la página citada. */
  verified: boolean;
  page: number | null;
}

export interface Citation {
  n: number;
  chunkId: string;
  documentId: string;
  documentTitle: string;
  documentKind: "pdf" | "docx" | "markdown" | "text";
  page: number;
  heading: string | null;
  excerpt: string;
  score: number;
  /** Se citó con [n] en la respuesta. */
  used: boolean;
  quotes: CitationQuote[];
}

export interface MessageUsage {
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    role: messageRole("role").notNull(),
    content: text("content").notNull(),
    citations: jsonb("citations").$type<Citation[]>().notNull().default([]),
    status: messageStatus("status").notNull().default("complete"),
    usage: jsonb("usage").$type<MessageUsage | null>(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId, t.createdAt)],
);

// --- Extracciones (cláusulas / campos por documento) ---------------------------------------

export interface ExtractionField {
  key: string;
  label: string;
  instructions: string;
}

export const extractions = pgTable(
  "extractions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    templateKey: text("template_key").notNull(),
    fields: jsonb("fields").$type<ExtractionField[]>().notNull(),
    documentIds: jsonb("document_ids").$type<string[]>().notNull(),
    status: extractionStatus("status").notNull().default("queued"),
    error: text("error"),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().defaultNow(),
    finishedAt: ts("finished_at"),
  },
  (t) => [index("extractions_workspace_idx").on(t.workspaceId, t.createdAt)],
);

export const extractionResults = pgTable(
  "extraction_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    extractionId: uuid("extraction_id")
      .notNull()
      .references(() => extractions.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    fieldKey: text("field_key").notNull(),
    value: text("value").notNull(),
    quote: text("quote"),
    page: integer("page"),
    verified: boolean("verified").notNull().default(false),
    found: boolean("found").notNull().default(true),
    score: real("score"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("extraction_results_unique_idx").on(t.extractionId, t.documentId, t.fieldKey)],
);

// --- Pagos --------------------------------------------------------------------------------

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    provider: text("provider").notNull(),
    plan: planId("plan").notNull(),
    status: paymentStatus("status").notNull().default("pending"),
    /** Precio del plan (USD, centavos). */
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull(),
    /** Lo que se cobra en la pasarela (Mercado Pago cobra en moneda local). */
    chargeCents: integer("charge_cents").notNull(),
    chargeCurrency: text("charge_currency").notNull(),
    days: integer("days").notNull(),
    providerRef: text("provider_ref"),
    captureRef: text("capture_ref"),
    createdAt: ts("created_at").notNull().defaultNow(),
    paidAt: ts("paid_at"),
    refundedAt: ts("refunded_at"),
  },
  (t) => [
    index("payments_workspace_idx").on(t.workspaceId, t.createdAt),
    index("payments_provider_ref_idx").on(t.provider, t.providerRef),
    index("payments_status_idx").on(t.status, t.createdAt),
  ],
);

/** Idempotencia de webhooks: cada evento de cada pasarela se procesa una sola vez. */
export const processedWebhooks = pgTable(
  "processed_webhooks",
  {
    provider: text("provider").notNull(),
    eventId: text("event_id").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.provider, t.eventId] })],
);

export type User = typeof users.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type MemberRole = (typeof memberRole.enumValues)[number];
export type Document = typeof documents.$inferSelect;
export type Payment = typeof payments.$inferSelect;
