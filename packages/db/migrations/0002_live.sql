CREATE TABLE "live_state" (
	"event_id" integer PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"fingerprint" text DEFAULT '' NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "timer_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "timer_paused_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "timer_running" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "planned_rounds" integer;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "top_cut_size" integer;--> statement-breakpoint
ALTER TABLE "live_state" ADD CONSTRAINT "live_state_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;