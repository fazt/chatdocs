-- Folio: migración inicial (escrita a mano, coherente con src/db/schema.ts).
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TYPE "user_role" AS ENUM ('user', 'admin');
--> statement-breakpoint
CREATE TYPE "member_role" AS ENUM ('owner', 'editor', 'viewer');
--> statement-breakpoint
CREATE TYPE "plan_id" AS ENUM ('free', 'pro', 'team');
--> statement-breakpoint
CREATE TYPE "collection_kind" AS ENUM ('legal', 'compliance', 'research', 'general');
--> statement-breakpoint
CREATE TYPE "document_kind" AS ENUM ('pdf', 'docx', 'markdown', 'text');
--> statement-breakpoint
CREATE TYPE "document_status" AS ENUM ('queued', 'processing', 'ready', 'failed');
--> statement-breakpoint
CREATE TYPE "conversation_mode" AS ENUM ('qa', 'compare');
--> statement-breakpoint
CREATE TYPE "message_role" AS ENUM ('user', 'assistant');
--> statement-breakpoint
CREATE TYPE "message_status" AS ENUM ('complete', 'aborted', 'error');
--> statement-breakpoint
CREATE TYPE "extraction_status" AS ENUM ('queued', 'running', 'done', 'failed');
--> statement-breakpoint
CREATE TYPE "payment_status" AS ENUM ('pending', 'paid', 'failed', 'refunded');
--> statement-breakpoint
CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "password_hash" text NOT NULL,
  "name" text NOT NULL,
  "role" "user_role" DEFAULT 'user' NOT NULL,
  "disabled_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL,
  "user_agent" text,
  "ip" text,
  "expires_at" timestamp with time zone NOT NULL,
  "last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" ("user_id");
--> statement-breakpoint
CREATE TABLE "password_resets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "password_resets_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE INDEX "password_resets_user_idx" ON "password_resets" ("user_id");
--> statement-breakpoint
CREATE TABLE "workspaces" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "plan" "plan_id" DEFAULT 'free' NOT NULL,
  "plan_expires_at" timestamp with time zone,
  "created_by_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" "member_role" NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "workspace_members_workspace_id_user_id_pk" PRIMARY KEY("workspace_id", "user_id")
);
--> statement-breakpoint
CREATE INDEX "workspace_members_user_idx" ON "workspace_members" ("user_id");
--> statement-breakpoint
CREATE TABLE "invitations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "role" "member_role" NOT NULL,
  "token_hash" text NOT NULL,
  "invited_by_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "accepted_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "invitations_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE INDEX "invitations_workspace_idx" ON "invitations" ("workspace_id");
--> statement-breakpoint
CREATE TABLE "usage_counters" (
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "period" text NOT NULL,
  "questions" integer DEFAULT 0 NOT NULL,
  "pages" integer DEFAULT 0 NOT NULL,
  "extractions" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "usage_counters_workspace_id_period_pk" PRIMARY KEY("workspace_id", "period")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "action" text NOT NULL,
  "target_type" text,
  "target_id" text,
  "meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "ip" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "audit_logs_workspace_created_idx" ON "audit_logs" ("workspace_id", "created_at");
--> statement-breakpoint
CREATE TABLE "collections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "kind" "collection_kind" DEFAULT 'general' NOT NULL,
  "created_by_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "collections_workspace_idx" ON "collections" ("workspace_id");
--> statement-breakpoint
CREATE TABLE "documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "collection_id" uuid NOT NULL REFERENCES "collections"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "original_name" text NOT NULL,
  "mime_type" text NOT NULL,
  "kind" "document_kind" NOT NULL,
  "size_bytes" integer NOT NULL,
  "sha256" text NOT NULL,
  "storage_key" text NOT NULL,
  "status" "document_status" DEFAULT 'queued' NOT NULL,
  "error" text,
  "page_count" integer DEFAULT 0 NOT NULL,
  "chunk_count" integer DEFAULT 0 NOT NULL,
  "embedding_model" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "uploaded_by_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "documents_workspace_idx" ON "documents" ("workspace_id", "created_at");
--> statement-breakpoint
CREATE INDEX "documents_collection_idx" ON "documents" ("collection_id");
--> statement-breakpoint
CREATE INDEX "documents_status_idx" ON "documents" ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX "documents_collection_sha_idx" ON "documents" ("collection_id", "sha256");
--> statement-breakpoint
CREATE TABLE "document_pages" (
  "document_id" uuid NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
  "page_number" integer NOT NULL,
  "heading" text,
  "text" text NOT NULL,
  CONSTRAINT "document_pages_document_id_page_number_pk" PRIMARY KEY("document_id", "page_number")
);
--> statement-breakpoint
CREATE TABLE "chunks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "document_id" uuid NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "page" integer NOT NULL,
  "heading" text,
  "char_start" integer DEFAULT 0 NOT NULL,
  "chunk_index" integer NOT NULL,
  "content" text NOT NULL,
  "token_count" integer DEFAULT 0 NOT NULL,
  "embedding" vector(1536) NOT NULL,
  "tsv" tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce("heading", '') || ' ' || "content")) STORED
);
--> statement-breakpoint
CREATE INDEX "chunks_document_idx" ON "chunks" ("document_id", "chunk_index");
--> statement-breakpoint
CREATE INDEX "chunks_workspace_idx" ON "chunks" ("workspace_id");
--> statement-breakpoint
CREATE INDEX "chunks_embedding_hnsw_idx" ON "chunks" USING hnsw ("embedding" vector_cosine_ops);
--> statement-breakpoint
CREATE INDEX "chunks_tsv_idx" ON "chunks" USING gin ("tsv");
--> statement-breakpoint
CREATE TABLE "conversations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "collection_id" uuid REFERENCES "collections"("id") ON DELETE SET NULL,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "title" text DEFAULT 'Nueva consulta' NOT NULL,
  "mode" "conversation_mode" DEFAULT 'qa' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "conversations_workspace_idx" ON "conversations" ("workspace_id", "updated_at");
--> statement-breakpoint
CREATE TABLE "conversation_documents" (
  "conversation_id" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "document_id" uuid NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
  CONSTRAINT "conversation_documents_conversation_id_document_id_pk" PRIMARY KEY("conversation_id", "document_id")
);
--> statement-breakpoint
CREATE TABLE "messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "role" "message_role" NOT NULL,
  "content" text NOT NULL,
  "citations" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "status" "message_status" DEFAULT 'complete' NOT NULL,
  "usage" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messages" ("conversation_id", "created_at");
--> statement-breakpoint
CREATE TABLE "extractions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "collection_id" uuid NOT NULL REFERENCES "collections"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "template_key" text NOT NULL,
  "fields" jsonb NOT NULL,
  "document_ids" jsonb NOT NULL,
  "status" "extraction_status" DEFAULT 'queued' NOT NULL,
  "error" text,
  "created_by_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "extractions_workspace_idx" ON "extractions" ("workspace_id", "created_at");
--> statement-breakpoint
CREATE TABLE "extraction_results" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "extraction_id" uuid NOT NULL REFERENCES "extractions"("id") ON DELETE CASCADE,
  "document_id" uuid NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
  "field_key" text NOT NULL,
  "value" text NOT NULL,
  "quote" text,
  "page" integer,
  "verified" boolean DEFAULT false NOT NULL,
  "found" boolean DEFAULT true NOT NULL,
  "score" real,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "extraction_results_unique_idx" ON "extraction_results" ("extraction_id", "document_id", "field_key");
--> statement-breakpoint
CREATE TABLE "payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "provider" text NOT NULL,
  "plan" "plan_id" NOT NULL,
  "status" "payment_status" DEFAULT 'pending' NOT NULL,
  "amount_cents" integer NOT NULL,
  "currency" text NOT NULL,
  "charge_cents" integer NOT NULL,
  "charge_currency" text NOT NULL,
  "days" integer NOT NULL,
  "provider_ref" text,
  "capture_ref" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "paid_at" timestamp with time zone,
  "refunded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "payments_workspace_idx" ON "payments" ("workspace_id", "created_at");
--> statement-breakpoint
CREATE INDEX "payments_provider_ref_idx" ON "payments" ("provider", "provider_ref");
--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" ("status", "created_at");
--> statement-breakpoint
CREATE TABLE "processed_webhooks" (
  "provider" text NOT NULL,
  "event_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "processed_webhooks_provider_event_id_pk" PRIMARY KEY("provider", "event_id")
);
