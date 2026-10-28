CREATE TYPE "public"."card_type" AS ENUM('Legend', 'Unit', 'Spell', 'Gear', 'Rune', 'Battlefield');--> statement-breakpoint
CREATE TYPE "public"."domain" AS ENUM('Fury', 'Calm', 'Mind', 'Body', 'Chaos', 'Order');--> statement-breakpoint
CREATE TABLE "card" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"subtitle" text,
	"type" "card_type",
	"supertypes" text[] DEFAULT '{}' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"domains" "domain"[] DEFAULT '{}' NOT NULL,
	"energy_cost" integer,
	"power_cost" integer,
	"might" integer,
	"might_bonus" integer,
	"rules_text" text DEFAULT '' NOT NULL,
	"effect_text" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_print" (
	"id" text PRIMARY KEY NOT NULL,
	"card_id" text NOT NULL,
	"code" text NOT NULL,
	"public_code" text NOT NULL,
	"set_id" text NOT NULL,
	"collector_number" integer NOT NULL,
	"variant" text,
	"rarity" text,
	"artist" text,
	"orientation" text DEFAULT 'portrait' NOT NULL,
	"image_file" text NOT NULL,
	CONSTRAINT "card_print_public_code_unique" UNIQUE("public_code")
);
--> statement-breakpoint
CREATE TABLE "card_set" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"print_count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legend" (
	"slug" text PRIMARY KEY NOT NULL,
	"card_id" text NOT NULL,
	"champion" text NOT NULL,
	"title" text NOT NULL,
	"domains" "domain"[] DEFAULT '{}' NOT NULL,
	CONSTRAINT "legend_card_id_unique" UNIQUE("card_id")
);
--> statement-breakpoint
ALTER TABLE "card_print" ADD CONSTRAINT "card_print_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."card"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_print" ADD CONSTRAINT "card_print_set_id_card_set_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."card_set"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legend" ADD CONSTRAINT "legend_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."card"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_name_idx" ON "card" USING btree ("name");--> statement-breakpoint
CREATE INDEX "card_type_idx" ON "card" USING btree ("type");--> statement-breakpoint
CREATE INDEX "card_print_card_idx" ON "card_print" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "card_print_set_idx" ON "card_print" USING btree ("set_id");