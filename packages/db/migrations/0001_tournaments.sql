CREATE TYPE "public"."event_kind" AS ENUM('main', 'side', 'community');--> statement-breakpoint
CREATE TABLE "event" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" "event_kind" NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"timezone" text,
	"address" text,
	"player_count" integer NOT NULL,
	"status" text NOT NULL,
	"metagame" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_round" (
	"id" integer PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"phase_id" integer NOT NULL,
	"phase_name" text NOT NULL,
	"phase_order" integer NOT NULL,
	"phase_type" text NOT NULL,
	"round_number" integer NOT NULL,
	"status" text NOT NULL,
	"is_final_round" boolean DEFAULT false NOT NULL,
	"ingested_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "legend_stats" (
	"scope" text NOT NULL,
	"legend" text NOT NULL,
	"pilots" integer NOT NULL,
	"events" integer NOT NULL,
	"wins" integer NOT NULL,
	"losses" integer NOT NULL,
	"draws" integer NOT NULL,
	"share" real NOT NULL,
	"win_rate" real,
	"wilson_low" real,
	"wilson_high" real,
	"shrunk_win_rate" real NOT NULL,
	"conversion" real NOT NULL,
	"top_cut_hits" integer NOT NULL,
	"power" integer NOT NULL,
	"tier" text NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legend_stats_scope_legend_pk" PRIMARY KEY("scope","legend")
);
--> statement-breakpoint
CREATE TABLE "match" (
	"id" integer PRIMARY KEY NOT NULL,
	"round_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	"table_number" integer,
	"status" text NOT NULL,
	"player1_id" integer,
	"player2_id" integer,
	"legend1" text,
	"legend2" text,
	"winner_id" integer,
	"games_winner" integer DEFAULT 0 NOT NULL,
	"games_loser" integer DEFAULT 0 NOT NULL,
	"games_drawn" integer DEFAULT 0 NOT NULL,
	"is_bye" boolean DEFAULT false NOT NULL,
	"is_draw" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matchup_stats" (
	"scope" text NOT NULL,
	"legend" text NOT NULL,
	"opponent" text NOT NULL,
	"wins" integer NOT NULL,
	"losses" integer NOT NULL,
	"draws" integer NOT NULL,
	CONSTRAINT "matchup_stats_scope_legend_opponent_pk" PRIMARY KEY("scope","legend","opponent")
);
--> statement-breakpoint
CREATE TABLE "pilot_stats" (
	"scope" text NOT NULL,
	"legend" text NOT NULL,
	"player_id" integer NOT NULL,
	"events" integer NOT NULL,
	"wins" integer NOT NULL,
	"losses" integer NOT NULL,
	"draws" integer NOT NULL,
	"best_rank" integer,
	"score" real NOT NULL,
	CONSTRAINT "pilot_stats_scope_legend_player_id_pk" PRIMARY KEY("scope","legend","player_id")
);
--> statement-breakpoint
CREATE TABLE "player" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"country_code" text,
	"hidden" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "power_snapshot" (
	"scope" text NOT NULL,
	"legend" text NOT NULL,
	"taken_at" timestamp with time zone NOT NULL,
	"power" integer NOT NULL,
	"tier" text NOT NULL,
	CONSTRAINT "power_snapshot_scope_legend_taken_at_pk" PRIMARY KEY("scope","legend","taken_at")
);
--> statement-breakpoint
CREATE TABLE "standing" (
	"round_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"rank" integer NOT NULL,
	"wins" integer NOT NULL,
	"losses" integer NOT NULL,
	"draws" integer NOT NULL,
	"points" integer NOT NULL,
	"omw" real,
	"gw" real,
	"ogw" real,
	"legend" text,
	CONSTRAINT "standing_round_id_player_id_pk" PRIMARY KEY("round_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "tracked_event" (
	"uvs_event_id" integer PRIMARY KEY NOT NULL,
	"display_name" text,
	"kind" "event_kind" DEFAULT 'main' NOT NULL,
	"metagame_override" text,
	"live" boolean DEFAULT false NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unknown_legend_name" (
	"name" text PRIMARY KEY NOT NULL,
	"seen" integer DEFAULT 1 NOT NULL,
	"legend_slug" text
);
--> statement-breakpoint
ALTER TABLE "event_round" ADD CONSTRAINT "event_round_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legend_stats" ADD CONSTRAINT "legend_stats_legend_legend_slug_fk" FOREIGN KEY ("legend") REFERENCES "public"."legend"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match" ADD CONSTRAINT "match_round_id_event_round_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."event_round"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match" ADD CONSTRAINT "match_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match" ADD CONSTRAINT "match_player1_id_player_id_fk" FOREIGN KEY ("player1_id") REFERENCES "public"."player"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match" ADD CONSTRAINT "match_player2_id_player_id_fk" FOREIGN KEY ("player2_id") REFERENCES "public"."player"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pilot_stats" ADD CONSTRAINT "pilot_stats_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standing" ADD CONSTRAINT "standing_round_id_event_round_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."event_round"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standing" ADD CONSTRAINT "standing_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standing" ADD CONSTRAINT "standing_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_starts_idx" ON "event" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "event_round_event_idx" ON "event_round" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "match_round_idx" ON "match" USING btree ("round_id");--> statement-breakpoint
CREATE INDEX "match_event_idx" ON "match" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "match_p1_idx" ON "match" USING btree ("player1_id");--> statement-breakpoint
CREATE INDEX "match_p2_idx" ON "match" USING btree ("player2_id");--> statement-breakpoint
CREATE INDEX "pilot_stats_rank_idx" ON "pilot_stats" USING btree ("scope","legend","score");--> statement-breakpoint
CREATE INDEX "standing_event_idx" ON "standing" USING btree ("event_id");