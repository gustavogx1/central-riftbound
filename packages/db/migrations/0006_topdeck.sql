-- Idempotente: pode rodar de novo sem erro.
-- Ids negativos para o que vem só do TopDeck.gg (os da UVS são positivos).
CREATE SEQUENCE IF NOT EXISTS "public"."topdeck_id_seq" INCREMENT BY -1 MINVALUE -2147483648 MAXVALUE -1 START WITH -1 CACHE 1;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "topdeck_ref" (
	"key" text PRIMARY KEY NOT NULL,
	"id" integer DEFAULT nextval('topdeck_id_seq') NOT NULL,
	CONSTRAINT "topdeck_ref_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "topdeck_event" (
	"tid" text PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL REFERENCES "public"."event"("id") ON DELETE cascade,
	"own" boolean NOT NULL,
	"name" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"player_count" integer NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_deck" (
	"event_id" integer NOT NULL REFERENCES "public"."event"("id") ON DELETE cascade,
	"topdeck_player_id" text NOT NULL,
	"tid" text NOT NULL,
	"player_id" integer REFERENCES "public"."player"("id") ON DELETE set null,
	"player_name" text NOT NULL,
	"rank" integer,
	"legend" text,
	"code" text,
	"unknown" text[] DEFAULT '{}' NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_deck_event_id_topdeck_player_id_pk" PRIMARY KEY("event_id","topdeck_player_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "topdeck_event_event_idx" ON "topdeck_event" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_deck_player_idx" ON "event_deck" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_deck_legend_idx" ON "event_deck" USING btree ("legend");--> statement-breakpoint
-- Mesma regra da 0005: só o servidor lê e grava; a API pública do Supabase não vê nada.
ALTER TABLE "topdeck_ref" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "topdeck_event" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "event_deck" ENABLE ROW LEVEL SECURITY;
