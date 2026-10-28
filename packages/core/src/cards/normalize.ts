import { slugify } from "./slug";
import {
  CARD_TYPES,
  DOMAINS,
  type Card,
  type CardPrint,
  type CardSet,
  type CardType,
  type Catalog,
  type Domain,
  type Legend,
  type RawCard,
} from "./types";

const SUPERTYPES = ["Champion", "Signature", "Basic", "Token"];
const SAME_CARD_THRESHOLD = 0.85;

/** Texto de regras sem lembretes entre parênteses, setas e espaços extras. */
function canonicalText(text: string): string {
  return text
    .replace(/\([^)]*\)/g, "")
    .replace(/\[>\]|—/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Coeficiente de Dice sobre bigramas do texto canônico (1 = igual). */
export function textSimilarity(a: string, b: string): number {
  const x = canonicalText(a);
  const y = canonicalText(b);
  if (x === y) return 1;
  if (x.length < 2 || y.length < 2) return 0;
  const bigrams = new Map<string, number>();
  for (let i = 0; i < x.length - 1; i++) {
    const g = x.slice(i, i + 2);
    bigrams.set(g, (bigrams.get(g) ?? 0) + 1);
  }
  let hits = 0;
  for (let i = 0; i < y.length - 1; i++) {
    const g = y.slice(i, i + 2);
    const n = bigrams.get(g) ?? 0;
    if (n > 0) {
      hits++;
      bigrams.set(g, n - 1);
    }
  }
  return (2 * hits) / (x.length - 1 + y.length - 1);
}

function toInt(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

function splitList(value: string): string[] {
  return value
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
}

function toType(value: string): CardType | null {
  return (CARD_TYPES as readonly string[]).includes(value) ? (value as CardType) : null;
}

function toDomains(values: string[]): Domain[] {
  return values.filter((d): d is Domain => (DOMAINS as readonly string[]).includes(d));
}


/**
 * Converte o cards.json em carta base + impressões + lendas.
 * Uma impressão com `same_card_as` aponta para a impressão base (pelo public_code).
 */
export function normalizeCatalog(rows: RawCard[], now = new Date()): Catalog {
  const byPublicCode = new Map(rows.map((r) => [r.public_code, r]));
  // Algumas variantes (overnumbered, signed, alt art) vêm da galeria sem same_card_as.
  // A base é a impressão sem variante com mesmo nome, tipo e tags E texto quase igual
  // (campeões repetem o nome em sets diferentes com textos diferentes).
  const identity = (r: RawCard) => [r.name, r.type, r.tags].join("\u0000");
  const plainByIdentity = new Map<string, RawCard[]>();
  for (const r of rows) {
    if (r.variant || r.same_card_as) continue;
    const list = plainByIdentity.get(identity(r)) ?? [];
    list.push(r);
    plainByIdentity.set(identity(r), list);
  }
  const inferBase = (r: RawCard): RawCard => {
    let best: RawCard = r;
    let bestScore = SAME_CARD_THRESHOLD;
    for (const candidate of plainByIdentity.get(identity(r)) ?? []) {
      const score = textSimilarity(r.rules_text, candidate.rules_text) + (candidate.set === r.set ? 0.01 : 0);
      if (score >= bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    return best;
  };
  const baseOf = (r: RawCard, depth = 0): RawCard => {
    if (depth > 5) throw new Error(`same_card_as em ciclo em ${r.id}`);
    if (!r.same_card_as) return r.variant ? inferBase(r) : r;
    const next = byPublicCode.get(r.same_card_as);
    if (!next) throw new Error(`same_card_as desconhecido em ${r.id}: ${r.same_card_as}`);
    return baseOf(next, depth + 1);
  };

  const cards = new Map<string, Card>();
  const prints: CardPrint[] = [];
  const sets = new Map<string, CardSet>();

  for (const r of rows) {
    const base = baseOf(r);
    if (!cards.has(base.id)) {
      const subtypes = splitList(base.subtypes);
      cards.set(base.id, {
        id: base.id,
        name: base.name,
        subtitle: base.subtitle || null,
        type: toType(base.type),
        supertypes: subtypes.filter((s) => SUPERTYPES.includes(s)),
        tags: splitList(base.tags),
        domains: toDomains(base.domains),
        energyCost: toInt(base.energy_cost),
        powerCost: toInt(base.power_cost),
        might: toInt(base.might),
        mightBonus: toInt(base.might_bonus),
        rulesText: base.rules_text,
        effectText: base.effect_text,
      });
    }

    prints.push({
      id: r.id,
      cardId: base.id,
      code: r.code,
      publicCode: r.public_code,
      setId: r.set,
      collectorNumber: r.collector_number,
      variant: r.variant || null,
      rarity: r.rarity || null,
      artist: r.artist || null,
      orientation: r.orientation === "landscape" ? "landscape" : "portrait",
      imageFile: `${r.id}.webp`,
    });

    const set = sets.get(r.set) ?? { id: r.set, name: r.set_name, printCount: 0 };
    set.printCount += 1;
    sets.set(r.set, set);
  }

  const legends: Legend[] = [];
  const usedSlugs = new Set<string>();
  for (const card of cards.values()) {
    if (card.type !== "Legend") continue;
    const champion = card.tags[0] ?? card.name;
    let slug = slugify(`${champion} ${card.name}`);
    for (let i = 2; usedSlugs.has(slug); i++) slug = `${slugify(`${champion} ${card.name}`)}-${i}`;
    usedSlugs.add(slug);
    legends.push({ slug, cardId: card.id, champion, title: card.name, domains: card.domains });
  }

  return {
    generatedAt: now.toISOString(),
    sets: [...sets.values()],
    cards: [...cards.values()],
    prints,
    legends: legends.sort((a, b) => a.slug.localeCompare(b.slug)),
  };
}
