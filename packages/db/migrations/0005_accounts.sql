-- Idempotente: pode rodar de novo sem erro (o Drizzle pula migrações mais antigas que a última aplicada).
DO $$ BEGIN
  CREATE TYPE "public"."deck_visibility" AS ENUM('private', 'unlisted', 'public');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profile" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_deck" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "public"."profile"("user_id") ON DELETE cascade,
	"name" text NOT NULL,
	"legend_card_id" text REFERENCES "public"."card"("id"),
	"code" text NOT NULL,
	"format" text DEFAULT 'constructed' NOT NULL,
	"legal" boolean DEFAULT false NOT NULL,
	"visibility" "deck_visibility" DEFAULT 'private' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "complexity_vote" (
	"user_id" uuid NOT NULL REFERENCES "public"."profile"("user_id") ON DELETE cascade,
	"legend" text NOT NULL REFERENCES "public"."legend"("slug"),
	"metagame" text NOT NULL,
	"value" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "complexity_vote_user_id_legend_metagame_pk" PRIMARY KEY("user_id","legend","metagame")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "complexity_vote_legend_idx" ON "complexity_vote" USING btree ("metagame","legend");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_deck_user_idx" ON "user_deck" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_deck_public_idx" ON "user_deck" USING btree ("visibility","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_deck_legend_idx" ON "user_deck" USING btree ("legend_card_id");--> statement-breakpoint
-- O site acessa o banco só pelo servidor (dono das tabelas, que não passa por RLS).
-- Com RLS ligado e sem políticas, a API pública do Supabase (chave publishable/anon) não lê nem grava nada.
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
