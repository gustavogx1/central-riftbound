-- Idempotente: pode rodar de novo sem erro.
-- Decklists enviadas pela comunidade, ligadas à classificação importada, com fila de moderação.
DO $$ BEGIN
  CREATE TYPE "public"."submission_status" AS ENUM('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deck_submission" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL REFERENCES "public"."event"("id") ON DELETE cascade,
	"player_id" integer NOT NULL REFERENCES "public"."player"("id") ON DELETE cascade,
	"user_id" uuid REFERENCES "public"."profile"("user_id") ON DELETE set null,
	"code" text NOT NULL,
	"legend" text,
	"expected_legend" text,
	"rank" integer,
	"source_url" text,
	"note" text DEFAULT '' NOT NULL,
	"status" "submission_status" DEFAULT 'pending' NOT NULL,
	"reject_reason" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deck_submission_status_idx" ON "deck_submission" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deck_submission_event_idx" ON "deck_submission" USING btree ("event_id","player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deck_submission_user_idx" ON "deck_submission" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deck_submission_legend_idx" ON "deck_submission" USING btree ("legend");--> statement-breakpoint
-- Uma lista aprovada por jogador e evento.
CREATE UNIQUE INDEX IF NOT EXISTS "deck_submission_approved_uq" ON "deck_submission" USING btree ("event_id","player_id") WHERE status = 'approved';--> statement-breakpoint
-- Mesma regra da 0005: só o servidor lê e grava; a API pública do Supabase não vê nada.
ALTER TABLE "deck_submission" ENABLE ROW LEVEL SECURITY;
