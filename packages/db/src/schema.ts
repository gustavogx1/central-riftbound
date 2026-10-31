import { sql } from "drizzle-orm";
import { boolean, index, integer, pgEnum, pgSequence, pgTable, primaryKey, real, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

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

/** main = Regional Qualifier; showdown = Showdown Series (torneios de terceiros chancelados pela Riot). */
export const eventKindEnum = pgEnum("event_kind", ["main", "side", "community", "showdown"]);
export type EventKind = (typeof eventKindEnum.enumValues)[number];

/** Eventos acompanhados, cadastrados à mão ou achados por `pnpm discover` (Showdowns). */
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
    /** Relógio da rodada atual, como o organizador mostra na UVS. */
    timerEndsAt: timestamp("timer_ends_at", { withTimezone: true }),
    timerPausedAt: timestamp("timer_paused_at", { withTimezone: true }),
    timerRunning: boolean("timer_running").notNull().default(false),
    plannedRounds: integer("planned_rounds"),
    topCutSize: integer("top_cut_size"),
    /** Detalhes do cabeçalho, como a UVS mostra (migração 0008). */
    format: text("format"),
    roundMinutes: integer("round_minutes"),
    /** Vitórias para levar a partida: 2 = melhor de 3. */
    gameWins: integer("game_wins"),
    organizer: text("organizer"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("event_starts_idx").on(t.startsAt)],
);

/**
 * Pulso dos eventos ao vivo: `version` sobe sempre que algo visível muda
 * (rodada, resultado, standings, relógio). A página só recarrega quando muda.
 */
export const liveState = pgTable("live_state", {
  eventId: integer("event_id")
    .primaryKey()
    .references(() => event.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(0),
  fingerprint: text("fingerprint").notNull().default(""),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
});

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

/**
 * Jogador como a UVS mostra publicamente. `name` = nome curto ("Marc R");
 * `nick` = apelido da inscrição mais recente (`nickAt` = início desse evento).
 * `hidden` = pediu remoção do nome.
 */
export const player = pgTable("player", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  nick: text("nick"),
  nickAt: timestamp("nick_at", { withTimezone: true }),
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

// ---------------------------------------------------------------------------
// TopDeck.gg (API oficial, com chave): decklists dos eventos grandes e os
// eventos que não estão na UVS. Quem vem só do TopDeck ganha id negativo,
// para nunca bater com os ids da UVS.
// ---------------------------------------------------------------------------

export const topdeckIdSeq = pgSequence("topdeck_id_seq", { increment: -1, startWith: -1, maxValue: -1, minValue: -2147483648 });

/** Id negativo estável para cada coisa do TopDeck ("e:<tid>", "p:<id do jogador>", "r:…", "m:…"). */
export const topdeckRef = pgTable("topdeck_ref", {
  key: text("key").primaryKey(),
  id: integer("id").notNull().unique().default(sql`nextval('topdeck_id_seq')`),
});

/**
 * Torneio do TopDeck ligado a um evento nosso. `own` = o evento foi criado a partir do
 * TopDeck; senão é um evento da UVS que recebeu as decklists.
 */
export const topdeckEvent = pgTable(
  "topdeck_event",
  {
    tid: text("tid").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    own: boolean("own").notNull(),
    name: text("name").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    playerCount: integer("player_count").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("topdeck_event_event_idx").on(t.eventId)],
);

/**
 * Decklist de um jogador num evento, como o TopDeck publica depois do fim. `playerId`
 * fica vazio quando o jogador do TopDeck não casou com ninguém da UVS. `code` é o
 * código de deck (formato do Piltover Archive); `unknown` = linhas que não reconhecemos.
 */
export const eventDeck = pgTable(
  "event_deck",
  {
    eventId: integer("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    topdeckPlayerId: text("topdeck_player_id").notNull(),
    tid: text("tid").notNull(),
    playerId: integer("player_id").references(() => player.id, { onDelete: "set null" }),
    playerName: text("player_name").notNull(),
    rank: integer("rank"),
    legend: text("legend"),
    code: text("code"),
    unknown: text("unknown").array().notNull().default([]),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.eventId, t.topdeckPlayerId] }),
    index("event_deck_player_idx").on(t.playerId),
    index("event_deck_legend_idx").on(t.legend),
  ],
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

// ---------------------------------------------------------------------------
// Contas (login pelo Supabase Auth). O site fala com estas tabelas só pelo
// servidor; a API pública do Supabase fica bloqueada por RLS (migração 0003).
// ---------------------------------------------------------------------------

/** Perfil público. `userId` é o id de auth.users; a linha nasce no primeiro login. */
export const profile = pgTable("profile", {
  userId: uuid("user_id").primaryKey(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const deckVisibilityEnum = pgEnum("deck_visibility", ["private", "unlisted", "public"]);

/** Deck salvo por um usuário. O conteúdo é o código de deck (formato do Piltover Archive). */
export const userDeck = pgTable(
  "user_deck",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profile.userId, { onDelete: "cascade" }),
    name: text("name").notNull(),
    legendCardId: text("legend_card_id").references(() => card.id),
    code: text("code").notNull(),
    format: text("format").notNull().default("constructed"),
    legal: boolean("legal").notNull().default(false),
    visibility: deckVisibilityEnum("visibility").notNull().default("private"),
    description: text("description").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("user_deck_user_idx").on(t.userId, t.updatedAt), index("user_deck_public_idx").on(t.visibility, t.updatedAt), index("user_deck_legend_idx").on(t.legendCardId)],
);

/** Voto de complexidade (1–5) por lenda e por set. Um voto por conta; pode mudar. */
export const complexityVote = pgTable(
  "complexity_vote",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profile.userId, { onDelete: "cascade" }),
    legend: text("legend")
      .notNull()
      .references(() => legend.slug),
    metagame: text("metagame").notNull(),
    value: integer("value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.legend, t.metagame] }), index("complexity_vote_legend_idx").on(t.metagame, t.legend)],
);

// ---------------------------------------------------------------------------
// Decklists enviadas pela comunidade, ligadas à classificação importada.
// Entram como pendentes e só aparecem no site depois da moderação.
// ---------------------------------------------------------------------------

export const submissionStatusEnum = pgEnum("submission_status", ["pending", "approved", "rejected"]);
export type SubmissionStatus = (typeof submissionStatusEnum.enumValues)[number];

/**
 * Decklist de um jogador num evento, enviada por um usuário logado. `legend` é a lenda da
 * lista; `expectedLegend` é a que a UVS registrou para o jogador (o envio só passa se baterem).
 * `rank` = posição final quando o envio foi feito. `sourceUrl` = onde a lista foi publicada,
 * quando quem envia não é o próprio jogador.
 */
export const deckSubmission = pgTable(
  "deck_submission",
  {
    id: text("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    playerId: integer("player_id")
      .notNull()
      .references(() => player.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => profile.userId, { onDelete: "set null" }),
    code: text("code").notNull(),
    legend: text("legend"),
    expectedLegend: text("expected_legend"),
    rank: integer("rank"),
    sourceUrl: text("source_url"),
    note: text("note").notNull().default(""),
    status: submissionStatusEnum("status").notNull().default("pending"),
    rejectReason: text("reject_reason"),
    reviewedBy: uuid("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("deck_submission_status_idx").on(t.status, t.createdAt),
    index("deck_submission_event_idx").on(t.eventId, t.playerId),
    index("deck_submission_user_idx").on(t.userId, t.createdAt),
    index("deck_submission_legend_idx").on(t.legend),
    // Uma lista aprovada por jogador e evento.
    uniqueIndex("deck_submission_approved_uq").on(t.eventId, t.playerId).where(sql`status = 'approved'`),
  ],
);
