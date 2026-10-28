import { index, integer, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const domainEnum = pgEnum("domain", ["Fury", "Calm", "Mind", "Body", "Chaos", "Order"]);
export const cardTypeEnum = pgEnum("card_type", ["Legend", "Unit", "Spell", "Gear", "Rune", "Battlefield"]);

export const cardSet = pgTable("card_set", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  printCount: integer("print_count").notNull(),
});

/** Carta base. Estatísticas e regras de deck somam sempre por aqui. */
export const card = pgTable(
  "card",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    subtitle: text("subtitle"),
    type: cardTypeEnum("type"),
    supertypes: text("supertypes").array().notNull().default([]),
    tags: text("tags").array().notNull().default([]),
    domains: domainEnum("domains").array().notNull().default([]),
    energyCost: integer("energy_cost"),
    powerCost: integer("power_cost"),
    might: integer("might"),
    mightBonus: integer("might_bonus"),
    rulesText: text("rules_text").notNull().default(""),
    effectText: text("effect_text").notNull().default(""),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("card_name_idx").on(t.name), index("card_type_idx").on(t.type)],
);

export const cardPrint = pgTable(
  "card_print",
  {
    id: text("id").primaryKey(),
    cardId: text("card_id").notNull().references(() => card.id),
    code: text("code").notNull(),
    publicCode: text("public_code").notNull().unique(),
    setId: text("set_id").notNull().references(() => cardSet.id),
    collectorNumber: integer("collector_number").notNull(),
    variant: text("variant"),
    rarity: text("rarity"),
    artist: text("artist"),
    orientation: text("orientation").notNull().default("portrait"),
    imageFile: text("image_file").notNull(),
  },
  (t) => [index("card_print_card_idx").on(t.cardId), index("card_print_set_idx").on(t.setId)],
);

export const legend = pgTable("legend", {
  slug: text("slug").primaryKey(),
  cardId: text("card_id").notNull().unique().references(() => card.id),
  champion: text("champion").notNull(),
  title: text("title").notNull(),
  domains: domainEnum("domains").array().notNull().default([]),
});
