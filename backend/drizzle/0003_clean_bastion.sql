CREATE TABLE IF NOT EXISTS "knowledge_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid NOT NULL,
	"content" text NOT NULL,
	"content_hash" text NOT NULL,
	"embedding" vector NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "embedding_status" varchar(32) DEFAULT 'queued' NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "embedding_progress" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "embedding_updated_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_chunks_source_hash_unique" ON "knowledge_chunks" ("source_id","content_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_chunks_source_id_idx" ON "knowledge_chunks" ("source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_chunks_user_id_idx" ON "knowledge_chunks" ("user_id");
