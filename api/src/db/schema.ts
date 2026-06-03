import { pgTable, text, integer, primaryKey } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  hashedPassword: text("hashed_password").notNull(),
  name: text("name").notNull().default(""),
  role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  resetToken: text("reset_token"),
  resetTokenExpires: text("reset_token_expires"),
  onboarding: text("onboarding").default("{}").notNull(),
  createdAt: text("created_at").notNull(),
});

export const documents = pgTable("documents", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  type: text("type", { enum: ["markdown", "image"] }).notNull().default("markdown"),
  url: text("url"),
  chunkCount: integer("chunk_count").default(0).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const chunks = pgTable("chunks", {
  id: text("id").primaryKey(),
  documentId: text("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  embedding: text("embedding").notNull(),
  heading: text("heading").default("").notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  tokenCount: integer("token_count").default(0).notNull(),
  createdAt: text("created_at").notNull(),
});

export const conversations = pgTable("conversations", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("New Chat"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
  content: text("content").notNull(),
  sources: text("sources"),
  tokenCount: integer("token_count").default(0).notNull(),
  createdAt: text("created_at").notNull(),
});

export const conversationDocuments = pgTable(
  "conversation_documents",
  {
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.conversationId, t.documentId] })]
);
