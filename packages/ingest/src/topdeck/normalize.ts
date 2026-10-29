import { encodeDeck, textToDeck, type PoolCard } from "@cr/core";
import type { EventKind } from "@cr/db";
import type { TdRound, TdStanding } from "./schemas";

// ---------------------------------------------------------------------------
// Quais torneios do TopDeck entram: só os grandes (Showdowns, Regionals, majors)
// ---------------------------------------------------------------------------

/** Mesmo piso do Showdown Series Tier III. */
export const TOPDECK_MIN_PLAYERS = 128;

const MAJOR = /showdown|regional|\bRQ\b|qualifier|championship|national|major|invitational|summit|\bopen\b|\$\s?\d[\d,.]*\s?k?|\b\d+\s?k\b/i;
const MAIN = /regional (qualifier|championship)|\bRQ\b/i;
/** Paralelos do fim de semana e eventos "a caminho de" ficam de fora. */
const SIDE = /grinder|rebound|daily|pre-?showdown|pre-?regional|last chance|side event|trial|road to|challenge\b/i;
const LIMITED = /sealed|draft|booster|pre-?con|2v2|free-?for-?all|\bffa\b/i;

/** "main" (Regional), "showdown" (Showdown e outros majors) ou null (fica de fora). */
export function classifyTopdeck(name: string, players: number): EventKind | null {
  if (players < TOPDECK_MIN_PLAYERS) return null;
  if (LIMITED.test(name) || SIDE.test(name) || !MAJOR.test(name)) return null;
  return MAIN.test(name) ? "main" : "showdown";
}

// ---------------------------------------------------------------------------
// Casar com um evento da UVS que já temos (para não duplicar)
// ---------------------------------------------------------------------------

export interface EventCandidate {
  id: number;
  name: string;
  startsAt: Date;
  playerCount: number;
}

const STOP = new Set(["riftbound", "tournament", "tcg", "the", "of", "at", "and", "cash", "event", "series", "showdown", "x", "vs"]);
const tokens = (s: string) =>
  new Set(
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((w) => w.length > 1 && !STOP.has(w)),
  );

function jaccard(a: Set<string>, b: Set<string>) {
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

/** Até 36 h de diferença no início (fuso, dia 2) e no máximo 20% de diferença no público. */
export const MATCH_MAX_HOURS = 36;
export const MATCH_MIN_SIZE_RATIO = 0.8;

/**
 * O mesmo torneio costuma estar nas duas plataformas (inscrição e decklist no TopDeck,
 * resultado oficial na UVS). Casa pela data e pelo tamanho; o nome desempata.
 */
export function matchUvsEvent(td: { name: string; startsAt: Date; players: number }, candidates: EventCandidate[]): EventCandidate | null {
  const tt = tokens(td.name);
  let best: { c: EventCandidate; score: number } | null = null;
  for (const c of candidates) {
    const hours = Math.abs(c.startsAt.getTime() - td.startsAt.getTime()) / 3_600_000;
    const ratio = Math.min(c.playerCount, td.players) / Math.max(c.playerCount, td.players, 1);
    if (hours > MATCH_MAX_HOURS || ratio < MATCH_MIN_SIZE_RATIO) continue;
    const score = ratio + jaccard(tt, tokens(c.name)) - hours / (MATCH_MAX_HOURS * 4);
    if (!best || score > best.score) best = { c, score };
  }
  return best?.c ?? null;
}

// ---------------------------------------------------------------------------
// Casar jogadores do TopDeck ("Nam Dang") com os da UVS ("Nam D", nick)
// ---------------------------------------------------------------------------

export interface TdPlayerRef {
  id: string;
  name: string;
  rank: number;
  legend: string | null;
}
export interface UvsPlayerRef {
  playerId: number;
  name: string;
  nick: string | null;
  rank: number;
  legend: string | null;
}

const clean = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** "Nam Dang" e "Nam D." → "nam d" (primeiro nome + inicial do último), como a UVS mostra. */
export function shortName(s: string): string {
  const parts = clean(s).split(" ").filter(Boolean);
  if (parts.length < 2) return parts[0] ?? "";
  return `${parts[0]} ${parts.at(-1)![0]}`;
}

/**
 * Para cada jogador do TopDeck (na ordem da classificação), o jogador da UVS com o
 * mesmo nome/nick; senão o mesmo "Nome I". Empates: mesma lenda, depois a colocação
 * mais próxima. Cada jogador da UVS é usado uma vez só; sem certeza, fica sem par.
 */
export function matchPlayers(td: TdPlayerRef[], uvs: UvsPlayerRef[]): Map<string, number> {
  const exact = new Map<string, UvsPlayerRef[]>();
  const short = new Map<string, UvsPlayerRef[]>();
  const push = (m: Map<string, UvsPlayerRef[]>, k: string, p: UvsPlayerRef) => k && m.set(k, [...(m.get(k) ?? []), p]);
  for (const p of uvs) {
    push(exact, clean(p.name), p);
    if (p.nick && clean(p.nick) !== clean(p.name)) push(exact, clean(p.nick), p);
    push(short, shortName(p.name), p);
  }
  const used = new Set<number>();
  const out = new Map<string, number>();
  for (const t of [...td].sort((a, b) => a.rank - b.rank)) {
    const free = (l: UvsPlayerRef[] | undefined) => (l ?? []).filter((p) => !used.has(p.playerId));
    let pool = free(exact.get(clean(t.name)));
    if (!pool.length) pool = free(short.get(shortName(t.name)));
    if (pool.length > 1 && t.legend) {
      const same = pool.filter((p) => p.legend === t.legend);
      if (same.length) pool = same;
    }
    if (pool.length > 1) {
      const dist = (p: UvsPlayerRef) => Math.abs(p.rank - t.rank);
      pool.sort((a, b) => dist(a) - dist(b));
      if (dist(pool[0]!) === dist(pool[1]!)) continue;
    }
    const hit = pool[0];
    if (!hit) continue;
    used.add(hit.playerId);
    out.set(t.id, hit.playerId);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Decklist → código de deck
// ---------------------------------------------------------------------------

function countOf(v: unknown): number {
  if (typeof v === "number") return v;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const k of ["count", "quantity", "qty", "amount"]) if (typeof o[k] === "number") return o[k] as number;
  }
  return 1;
}

/**
 * `deckObj` do TopDeck em texto ("Seção:\nN Nome"). Aceita seções como objeto
 * nome → número/{count} ou como lista de {name, count}.
 */
export function deckObjToText(obj: Record<string, unknown>): string {
  const blocks: string[] = [];
  for (const [section, cards] of Object.entries(obj)) {
    const lines: string[] = [];
    if (Array.isArray(cards)) {
      for (const c of cards) {
        const o = (c ?? {}) as Record<string, unknown>;
        const name = typeof c === "string" ? c : typeof o.name === "string" ? o.name : null;
        if (name) lines.push(`${countOf(c)} ${name}`);
      }
    } else if (cards && typeof cards === "object") {
      for (const [name, v] of Object.entries(cards as Record<string, unknown>)) lines.push(`${countOf(v)} ${name}`);
    }
    if (lines.length) blocks.push(`${section}:\n${lines.join("\n")}`);
  }
  return blocks.join("\n\n");
}

export interface ConvertedDeck {
  code: string | null;
  legendCardId: string | null;
  unknown: string[];
}

/** Decklist do TopDeck (estruturada ou em texto) no nosso código de deck. Link sem lista = sem código. */
export function convertDeck(s: Pick<TdStanding, "deckObj" | "decklist">, pool: Map<string, PoolCard>): ConvertedDeck {
  const text = s.deckObj && Object.keys(s.deckObj).length ? deckObjToText(s.deckObj) : s.decklist && !/^https?:\/\//i.test(s.decklist.trim()) ? s.decklist : "";
  if (!text.trim()) return { code: null, legendCardId: null, unknown: [] };
  const { deck, unknown } = textToDeck(text, pool);
  let code: string | null = null;
  try {
    code = encodeDeck(deck, pool) || null;
  } catch {
    code = null;
  }
  return { code, legendCardId: deck.legend, unknown };
}

// ---------------------------------------------------------------------------
// Evento que só existe no TopDeck: rodadas, partidas e classificação no nosso formato
// ---------------------------------------------------------------------------

export type RefKey = (key: string) => number;

/** Chaves estáveis de cada coisa do TopDeck, para pedir os ids negativos de uma vez. */
export function ownKeys(tid: string, rounds: TdRound[], standings: TdStanding[]): string[] {
  const keys = new Set<string>([`e:${tid}`]);
  for (const s of standings) if (s.id) keys.add(`p:${s.id}`);
  rounds.forEach((r, i) => {
    keys.add(`r:${tid}:${r.round}`);
    keys.add(`ph:${tid}:${typeof r.round === "number" ? "swiss" : r.round}`);
    for (const t of r.tables) {
      for (const p of t.players) if (p.id) keys.add(`p:${p.id}`);
      if (t.status === "Bye" || t.table === "Byes") t.players.forEach((p) => keys.add(`m:${tid}:${i}:bye:${p.id}`));
      else keys.add(`m:${tid}:${i}:${t.table}`);
    }
  });
  return [...keys];
}

const STATUS: Record<string, string> = { Completed: "COMPLETE", Bye: "COMPLETE", Active: "IN_PROGRESS", Pending: "IN_PROGRESS" };

export function ownRows(tid: string, rounds: TdRound[], standings: TdStanding[], ref: RefKey, resolveLegend: (name: string | null | undefined) => string | null) {
  const eventId = ref(`e:${tid}`);
  const legendOf = new Map(standings.filter((s) => s.id).map((s) => [s.id!, resolveLegend(s.leader)]));
  const roundRows: { id: number; eventId: number; phaseId: number; phaseName: string; phaseOrder: number; phaseType: string; roundNumber: number; status: string; isFinalRound: boolean }[] = [];
  const matchRows: {
    id: number; roundId: number; eventId: number; tableNumber: number | null; status: string; player1Id: number | null; player2Id: number | null;
    legend1: string | null; legend2: string | null; winnerId: number | null; gamesWinner: number; gamesLoser: number; gamesDrawn: number; isBye: boolean; isDraw: boolean;
  }[] = [];
  // Rodadas numeradas = suíço; as com nome ("Top 8") = corte, cada uma na sua fase.
  let bracket = 0;
  const swissRecord = new Map<string, { wins: number; losses: number; draws: number }>();
  rounds.forEach((r, i) => {
    const swiss = typeof r.round === "number";
    if (!swiss) bracket++;
    const id = ref(`r:${tid}:${r.round}`);
    const done = r.tables.length > 0 && r.tables.every((t) => STATUS[t.status] === "COMPLETE");
    roundRows.push({
      id,
      eventId,
      phaseId: ref(`ph:${tid}:${swiss ? "swiss" : r.round}`),
      phaseName: swiss ? "Swiss" : String(r.round),
      phaseOrder: swiss ? 1 : 1 + bracket,
      phaseType: swiss ? "SWISS" : "SINGLE_ELIMINATION",
      roundNumber: swiss ? (r.round as number) : 1,
      status: done ? "COMPLETE" : "IN_PROGRESS",
      isFinalRound: i === rounds.length - 1,
    });
    for (const t of r.tables) {
      const pid = (p: { id?: string | null } | undefined) => (p?.id ? ref(`p:${p.id}`) : null);
      const status = STATUS[t.status] ?? "IN_PROGRESS";
      if (t.status === "Bye" || t.table === "Byes") {
        for (const p of t.players) {
          if (!p.id) continue;
          matchRows.push({ id: ref(`m:${tid}:${i}:bye:${p.id}`), roundId: id, eventId, tableNumber: null, status: "COMPLETE", player1Id: pid(p), player2Id: null,
            legend1: legendOf.get(p.id) ?? resolveLegend(p.leader), legend2: null, winnerId: pid(p), gamesWinner: 0, gamesLoser: 0, gamesDrawn: 0, isBye: true, isDraw: false });
          if (swiss) {
            const rec = swissRecord.get(p.id) ?? { wins: 0, losses: 0, draws: 0 };
            rec.wins++;
            swissRecord.set(p.id, rec);
          }
        }
        continue;
      }
      const [a, b] = t.players;
      const isDraw = status === "COMPLETE" && (t.winner_id === "Draw" || !t.winner_id);
      const winner = !isDraw && t.winner_id ? t.players.find((p) => p.id === t.winner_id) : undefined;
      matchRows.push({
        id: ref(`m:${tid}:${i}:${t.table}`),
        roundId: id,
        eventId,
        tableNumber: typeof t.table === "number" ? t.table : null,
        status,
        player1Id: pid(a),
        player2Id: pid(b),
        legend1: a?.id ? (legendOf.get(a.id) ?? resolveLegend(a.leader)) : null,
        legend2: b?.id ? (legendOf.get(b.id) ?? resolveLegend(b.leader)) : null,
        winnerId: winner ? pid(winner) : null,
        gamesWinner: t.winner_games ?? 0,
        gamesLoser: t.loser_games ?? 0,
        gamesDrawn: 0,
        isBye: t.players.length < 2,
        isDraw,
      });
      if (swiss && status === "COMPLETE") {
        for (const p of t.players) {
          if (!p.id) continue;
          const rec = swissRecord.get(p.id) ?? { wins: 0, losses: 0, draws: 0 };
          if (isDraw) rec.draws++;
          else if (winner?.id === p.id) rec.wins++;
          else rec.losses++;
          swissRecord.set(p.id, rec);
        }
      }
    }
  });

  // Classificação final na última rodada do suíço (é a que as estatísticas leem).
  const lastSwiss = [...roundRows].reverse().find((r) => r.phaseType === "SWISS") ?? roundRows.at(-1);
  const standingRows = lastSwiss
    ? standings
        .filter((s) => s.id)
        .map((s) => {
          const rec = swissRecord.get(s.id!) ?? { wins: 0, losses: 0, draws: 0 };
          return {
            roundId: lastSwiss.id,
            eventId,
            playerId: ref(`p:${s.id}`),
            rank: s.standing,
            ...rec,
            points: s.points ?? rec.wins * 3 + rec.draws,
            omw: s.opponentWinRate ?? null,
            gw: null,
            ogw: null,
            legend: legendOf.get(s.id!) ?? null,
          };
        })
    : [];

  const players = new Map<number, { id: number; name: string }>();
  for (const s of standings) if (s.id) players.set(ref(`p:${s.id}`), { id: ref(`p:${s.id}`), name: s.name });
  for (const r of rounds) for (const t of r.tables) for (const p of t.players) if (p.id && !players.has(ref(`p:${p.id}`))) players.set(ref(`p:${p.id}`), { id: ref(`p:${p.id}`), name: p.name });

  return { eventId, roundRows, matchRows, standingRows, playerRows: [...players.values()], swissRounds: roundRows.filter((r) => r.phaseType === "SWISS").length };
}
