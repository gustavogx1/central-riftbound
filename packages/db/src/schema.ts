import { boolean, index, integer, pgEnum, pgTable, primaryKey, real, text, timestamp } from "drizzle-orm/pg-core";

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

// ---------------------------------------------------------------------------
// Torneios (fonte: API pública da UVS/Spicerack)
// ---------------------------------------------------------------------------

export const eventKindEnum = pgEnum("event_kind", ["main", "side", "community"]);

/** Eventos acompanhados, cadastrados à mão (ou aceitos da lista de sugestões). */
export const trackedEvent = pgTable("tracked_event", {
  uvsEventId: integer("uvs_event_id").primaryKey(),
  displayName: text("display_name"),
  kind: eventKindEnum("kind").notNull().default("main"),
  /** Força o metagame (set) quando a detecção automática errar. */
  metagameOverride: text("metagame_override"),
  live: boolean("live").notNull().default(false),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
});

export const event = pgTable(
  "event",
  {
    id: integer("id").primaryKey(),
    name: text("name").notNull(),
    kind: eventKindEnum("kind").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    timezone: text("timezone"),
    address: text("address"),
    playerCount: integer("player_count").notNull(),
    status: text("status").notNull(),
    metagame: text("metagame"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("event_starts_idx").on(t.startsAt)],
);

export const eventRound = pgTable(
  "event_round",
  {
    id: integer("id").primaryKey(),
    eventId: integer("event_id").notNull().references(() => event.id, { onDelete: "cascade" }),
    phaseId: integer("phase_id").notNull(),
    phaseName: text("phase_name").notNull(),
    phaseOrder: integer("phase_order").notNull(),
    phaseType: text("phase_type").notNull(),
    roundNumber: integer("round_number").notNull(),
    status: text("status").notNull(),
    isFinalRound: boolean("is_final_round").notNull().default(false),
    /** Quando partidas e standings desta rodada foram gravados por completo. */
    ingestedAt: timestamp("ingested_at", { withTimezone: true }),
  },
  (t) => [index("event_round_event_idx").on(t.eventId)],
);

/** Jogador como a UVS mostra publicamente. `hidden` = pediu remoção do nome. */
export const player = pgTable("player", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  countryCode: text("country_code"),
  hidden: boolean("hidden").notNull().default(false),
});

export const match = pgTable(
  "match",
  {
    id: integer("id").primaryKey(),
    roundId: integer("round_id").notNull().references(() => eventRound.id, { onDelete: "cascade" }),
    eventId: integer("event_id").notNull().references(() => event.id, { onDelete: "cascade" }),
    tableNumber: integer("table_number"),
    status: text("status").notNull(),
    player1Id: integer("player1_id").references(() => player.id),
    player2Id: integer("player2_id").references(() => player.id),
    legend1: text("legend1"),
    legend2: text("legend2"),
    winnerId: integer("winner_id"),
    gamesWinner: integer("games_winner").notNull().default(0),
    gamesLoser: integer("games_loser").notNull().default(0),
    gamesDrawn: integer("games_drawn").notNull().default(0),
    isBye: boolean("is_bye").notNull().default(false),
    isDraw: boolean("is_draw").notNull().default(false),
  },
  (t) => [
    index("match_round_idx").on(t.roundId),
    index("match_event_idx").on(t.eventId),
    index("match_p1_idx").on(t.player1Id),
    index("match_p2_idx").on(t.player2Id),
  ],
);

export const standing = pgTable(
  "standing",
  {
    roundId: integer("round_id").notNull().references(() => eventRound.id, { onDelete: "cascade" }),
    eventId: integer("event_id").notNull().references(() => event.id, { onDelete: "cascade" }),
    playerId: integer("player_id").notNull().references(() => player.id),
    rank: integer("rank").notNull(),
    wins: integer("wins").notNull(),
    losses: integer("losses").notNull(),
    draws: integer("draws").notNull(),
    points: integer("points").notNull(),
    omw: real("omw"),
    gw: real("gw"),
    ogw: real("ogw"),
    legend: text("legend"),
  },
  (t) => [primaryKey({ columns: [t.roundId, t.playerId] }), index("standing_event_idx").on(t.eventId)],
);

/** Nome da lenda como a UVS manda ("Nasus, Curator of the Sands") que não casou com o catálogo. */
export const unknownLegendName = pgTable("unknown_legend_name", {
  name: text("name").primaryKey(),
  seen: integer("seen").notNull().default(1),
  legendSlug: text("legend_slug"),
});

// ---------------------------------------------------------------------------
// Estatísticas agregadas, recalculadas após cada importação
// ---------------------------------------------------------------------------

/** `scope` = "<metagame|all>:<main|all>". */
export const legendStats = pgTable(
  "legend_stats",
  {
    scope: text("scope").notNull(),
    legend: text("legend").notNull().references(() => legend.slug),
    pilots: integer("pilots").notNull(),
    events: integer("events").notNull(),
    wins: integer("wins").notNull(),
    losses: integer("losses").notNull(),
    draws: integer("draws").notNull(),
    share: real("share").notNull(),
    winRate: real("win_rate"),
    wilsonLow: real("wilson_low"),
    wilsonHigh: real("wilson_high"),
    shrunkWinRate: real("shrunk_win_rate").notNull(),
    conversion: real("conversion").notNull(),
    topCutHits: integer("top_cut_hits").notNull(),
    power: integer("power").notNull(),
    tier: text("tier").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.scope, t.legend] })],
);

export const matchupStats = pgTable(
  "matchup_stats",
  {
    scope: text("scope").notNull(),
    legend: text("legend").notNull(),
    opponent: text("opponent").notNull(),
    wins: integer("wins").notNull(),
    losses: integer("losses").notNull(),
    draws: integer("draws").notNull(),
  },
  (t) => [primaryKey({ columns: [t.scope, t.legend, t.opponent] })],
);

export const pilotStats = pgTable(
  "pilot_stats",
  {
    scope: text("scope").notNull(),
    legend: text("legend").notNull(),
    playerId: integer("player_id").notNull().references(() => player.id),
    events: integer("events").notNull(),
    wins: integer("wins").notNull(),
    losses: integer("losses").notNull(),
    draws: integer("draws").notNull(),
    bestRank: integer("best_rank"),
    score: real("score").notNull(),
  },
  (t) => [primaryKey({ columns: [t.scope, t.legend, t.playerId] }), index("pilot_stats_rank_idx").on(t.scope, t.legend, t.score)],
);

/** Histórico de poder para "subiram / caíram". Um snapshot por recálculo e escopo. */
export const powerSnapshot = pgTable(
  "power_snapshot",
  {
    scope: text("scope").notNull(),
    legend: text("legend").notNull(),
    takenAt: timestamp("taken_at", { withTimezone: true }).notNull(),
    power: integer("power").notNull(),
    tier: text("tier").notNull(),
  },
  (t) => [primaryKey({ columns: [t.scope, t.legend, t.takenAt] })],
);
