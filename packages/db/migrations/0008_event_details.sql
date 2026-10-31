ALTER TABLE "event" ADD COLUMN IF NOT EXISTS "format" text;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN IF NOT EXISTS "round_minutes" integer;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN IF NOT EXISTS "game_wins" integer;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN IF NOT EXISTS "organizer" text;