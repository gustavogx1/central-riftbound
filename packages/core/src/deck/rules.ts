import type { DeckFormat, DeckIssue, DeckList, PoolCard } from "./types";

/**
 * Regras de construção.
 * Core Rules 103 (9 out. 2026) e Tournament Rules 402.1 / 601.1 (9 out. 2026).
 */
export const DECK_RULES = {
  /** CR 103.3: pelo menos 40; TR 601.1.b: exatamente 40 em competição. */
  mainSize: 40,
  /** CR 103.3.b: até 3 cópias do mesmo nome (campeão escolhido incluído). */
  copies: 3,
  /** CR 103.3.d: até 3 cartas Signature no total. */
  signatures: 3,
  /** CR 103.4.a: 12 runas. */
  runes: 12,
  /** TR 402.1: exatamente 3 campos de batalha, nomes diferentes. */
  battlefields: 3,
  /** TR 601.1.c.1: até 10 cartas no sideboard. */
  side: 10,
  /** Neeko: "choose 3 different legends in addition to your starting legend". */
  extraLegends: 3,
} as const;

/**
 * Banidas no Constructed sancionado (Rules Hub, atualizado em 18 set. 2026).
 * Nomes completos como aparecem na carta.
 */
export const BANNED_CONSTRUCTED = [
  "Called Shot",
  "Ekko, Recurrent",
  "Draven, Vanquisher",
  "Fight or Flight",
  "Scrapheap",
  "Stealthy Pursuer",
  "Stacked Deck",
  "The Arena's Greatest",
  "Aspirant's Climb",
  "The Dreaming Tree",
  "Obelisk of Power",
  "Reaver's Row",
] as const;

const BANNED = new Set<string>(BANNED_CONSTRUCTED.map((n) => n.toLowerCase()));

/** Nome completo: "Jinx, Demolitionist". O limite de cópias vale por nome (CR 103.3.b.2). */
export const fullName = (c: Pick<PoolCard, "name" | "subtitle">) => (c.subtitle ? `${c.name}, ${c.subtitle}` : c.name);

export const isBanned = (c: Pick<PoolCard, "name" | "subtitle">) => BANNED.has(fullName(c).toLowerCase());

/** Tag de campeão da lenda (a lenda tem uma só, ex.: "Jinx"). */
export const legendTag = (legend: PoolCard) => legend.tags[0] ?? null;

/** Máximo de cópias pelo texto da carta: [Unique] = 1, "any number of cards named" = sem limite. */
export function copyLimit(c: PoolCard): number {
  if (/your deck can have any number of cards named/i.test(c.rulesText)) return Infinity;
  if (/\[Unique\]/i.test(c.rulesText)) return 1;
  return DECK_RULES.copies;
}

/** CR 103.2.b.3–5: sem domínio vale em qualquer deck; com vários, a identidade precisa ter todos. */
export function inIdentity(c: PoolCard, legend: PoolCard | null): boolean {
  if (!legend || c.domains.length === 0) return true;
  return c.domains.every((d) => legend.domains.includes(d));
}

/** Cartas que podem ir no deck principal (e no sideboard). */
export const isMainCard = (c: PoolCard) => (c.type === "Unit" || c.type === "Spell" || c.type === "Gear") && !c.supertypes.includes("Token");

export const isSignature = (c: PoolCard) => c.supertypes.includes("Signature");

/** CR 103.3.a.2: unidade campeã com a tag da lenda. */
export function canBeChampion(c: PoolCard, legend: PoolCard | null): boolean {
  if (c.type !== "Unit" || !c.supertypes.includes("Champion")) return false;
  const tag = legend ? legendTag(legend) : null;
  return !tag || c.tags.includes(tag);
}

/** Permite lendas extras quando há uma carta com esse efeito no deck. */
export const grantsExtraLegends = (c: PoolCard) => /choose 3 different legends in addition to your starting legend/i.test(c.rulesText);

const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

export function mainCount(deck: DeckList): number {
  return sum(deck.main) + (deck.champion ? 1 : 0);
}

export const runeCount = (deck: DeckList) => sum(deck.runes);
export const sideCount = (deck: DeckList) => sum(deck.side);

/** Confere o deck e devolve os problemas encontrados, do mais grave ao menos grave. */
export function validateDeck(deck: DeckList, pool: Map<string, PoolCard>, format: DeckFormat = "constructed"): DeckIssue[] {
  const issues: DeckIssue[] = [];
  const err = (code: string, params?: DeckIssue["params"]) => issues.push({ severity: "error", code, params });
  const warn = (code: string, params?: DeckIssue["params"]) => issues.push({ severity: "warning", code, params });
  const get = (id: string) => pool.get(id);

  const legend = deck.legend ? get(deck.legend) ?? null : null;
  if (!legend) err("legendMissing");
  else if (legend.type !== "Legend") err("notLegend", { name: fullName(legend) });

  const champion = deck.champion ? get(deck.champion) ?? null : null;
  if (!champion) err("championMissing");
  else if (!canBeChampion(champion, legend)) err("championInvalid", { name: fullName(champion), tag: legend ? legendTag(legend) ?? "" : "" });

  const main = mainCount(deck);
  if (format === "constructed" ? main !== DECK_RULES.mainSize : main < DECK_RULES.mainSize) {
    err(format === "constructed" ? "mainExact" : "mainMin", { count: main, size: DECK_RULES.mainSize });
  }

  // Cópias por nome somam deck principal, campeão e sideboard (TR 601.1.c.3).
  const byName = new Map<string, { card: PoolCard; count: number }>();
  const add = (id: string, n: number) => {
    const c = get(id);
    if (!c || n <= 0) return;
    const key = fullName(c).toLowerCase();
    const cur = byName.get(key) ?? { card: c, count: 0 };
    cur.count += n;
    byName.set(key, cur);
  };
  if (champion) add(champion.id, 1);
  for (const [id, n] of Object.entries(deck.main)) add(id, n);
  if (format === "constructed") for (const [id, n] of Object.entries(deck.side)) add(id, n);
  for (const { card, count } of byName.values()) {
    const max = copyLimit(card);
    if (count > max) err("copies", { name: fullName(card), count, max });
  }

  const tag = legend ? legendTag(legend) : null;
  let signatures = 0;
  const checkCard = (id: string, n: number, zone: "main" | "side") => {
    const c = get(id);
    if (!c) return err("unknownCard", { id });
    if (!isMainCard(c)) return err("wrongZone", { name: fullName(c) });
    if (!inIdentity(c, legend)) err("domain", { name: fullName(c) });
    if (format === "constructed" && isBanned(c)) err("banned", { name: fullName(c) });
    if (isSignature(c)) {
      if (zone === "main") signatures += n;
      if (tag && !c.tags.includes(tag)) err("signatureTag", { name: fullName(c), tag });
    }
  };
  if (champion) checkCard(champion.id, 1, "main");
  for (const [id, n] of Object.entries(deck.main)) checkCard(id, n, "main");
  if (signatures > DECK_RULES.signatures) err("signatures", { count: signatures, max: DECK_RULES.signatures });

  const runes = runeCount(deck);
  if (runes !== DECK_RULES.runes) err("runes", { count: runes, size: DECK_RULES.runes });
  for (const id of Object.keys(deck.runes)) {
    const c = get(id);
    if (!c) err("unknownCard", { id });
    else if (c.type !== "Rune") err("wrongZone", { name: fullName(c) });
    else if (!inIdentity(c, legend)) err("domain", { name: fullName(c) });
  }

  if (deck.battlefields.length !== DECK_RULES.battlefields) err("battlefields", { count: deck.battlefields.length, size: DECK_RULES.battlefields });
  const fields = new Set<string>();
  for (const id of deck.battlefields) {
    const c = get(id);
    if (!c) {
      err("unknownCard", { id });
      continue;
    }
    if (c.type !== "Battlefield" || c.supertypes.includes("Token")) err("wrongZone", { name: fullName(c) });
    const key = fullName(c).toLowerCase();
    if (fields.has(key)) err("battlefieldDuplicate", { name: fullName(c) });
    fields.add(key);
    if (!inIdentity(c, legend)) err("domain", { name: fullName(c) });
    if (format === "constructed" && isBanned(c)) err("banned", { name: fullName(c) });
  }

  if (format === "constructed") {
    const side = sideCount(deck);
    if (side > DECK_RULES.side) err("side", { count: side, max: DECK_RULES.side });
    for (const [id, n] of Object.entries(deck.side)) checkCard(id, n, "side");
  }

  const ids = [champion?.id, ...Object.keys(deck.main)].filter(Boolean) as string[];
  const needsExtra = ids.some((id) => {
    const c = get(id);
    return c ? grantsExtraLegends(c) : false;
  });
  if (needsExtra) {
    const names = new Set(deck.extraLegends.map((id) => get(id)).filter((c) => c?.type === "Legend").map((c) => fullName(c!)));
    if (legend) names.delete(fullName(legend));
    if (deck.extraLegends.length !== DECK_RULES.extraLegends || names.size !== DECK_RULES.extraLegends) {
      err("extraLegends", { count: names.size, size: DECK_RULES.extraLegends });
    }
  } else if (deck.extraLegends.length) {
    warn("extraLegendsUnused");
  }

  return issues;
}
