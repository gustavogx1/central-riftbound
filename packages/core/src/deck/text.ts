import { fullName, legendTag } from "./rules";
import { emptyDeck, type DeckList, type PoolCard } from "./types";

type Section = "legend" | "champion" | "main" | "battlefields" | "runes" | "side" | "extraLegends";

/** Cabeçalhos de seção, em inglês (padrão dos sites da comunidade); a leitura aceita variações. */
const HEADERS: [Section, string][] = [
  ["legend", "Legend"],
  ["champion", "Champion"],
  ["main", "Main Deck"],
  ["battlefields", "Battlefields"],
  ["runes", "Runes"],
  ["side", "Sideboard"],
  ["extraLegends", "Additional Legends"],
];

const ALIASES: Record<string, Section> = {
  legend: "legend",
  legends: "legend",
  lenda: "legend",
  champion: "champion",
  "chosen champion": "champion",
  campeao: "champion",
  "campeão": "champion",
  main: "main",
  "main deck": "main",
  maindeck: "main",
  mainboard: "main",
  deck: "main",
  "deck principal": "main",
  battlefield: "battlefields",
  battlefields: "battlefields",
  "campos de batalha": "battlefields",
  rune: "runes",
  runes: "runes",
  "rune deck": "runes",
  runas: "runes",
  sideboard: "side",
  "side deck": "side",
  side: "side",
  "additional legends": "extraLegends",
  "lendas extras": "extraLegends",
};

/** Nome que aparece na lista: lendas levam a tag do campeão na frente ("Jinx, Loose Cannon"). */
export function listName(c: PoolCard): string {
  if (c.type === "Legend") {
    const tag = legendTag(c);
    return tag ? `${tag}, ${c.name}` : c.name;
  }
  return fullName(c);
}

export function deckToText(deck: DeckList, pool: Map<string, PoolCard>): string {
  const name = (id: string) => (pool.get(id) ? listName(pool.get(id)!) : id);
  const lines = (r: Record<string, number>) =>
    Object.entries(r)
      .filter(([, n]) => n > 0)
      .sort(([a], [b]) => name(a).localeCompare(name(b)))
      .map(([id, n]) => `${n} ${name(id)}`);
  const blocks: [Section, string[]][] = [
    ["legend", deck.legend ? [`1 ${name(deck.legend)}`] : []],
    ["champion", deck.champion ? [`1 ${name(deck.champion)}`] : []],
    ["main", lines(deck.main)],
    ["battlefields", deck.battlefields.map((id) => `1 ${name(id)}`)],
    ["runes", lines(deck.runes)],
    ["side", lines(deck.side)],
    ["extraLegends", deck.extraLegends.map((id) => `1 ${name(id)}`)],
  ];
  return blocks
    .filter(([, l]) => l.length)
    .map(([s, l]) => `${HEADERS.find(([k]) => k === s)![1]}:\n${l.join("\n")}`)
    .join("\n\n");
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export interface ParsedText {
  deck: DeckList;
  /** Linhas que não reconhecemos. */
  unknown: string[];
}

/**
 * Lê uma lista em texto: "3 Nome", "3x Nome", "Nome x3" ou um código de impressão (OGN-007).
 * Sem cabeçalhos, cada carta vai para a seção do seu tipo.
 */
export function textToDeck(text: string, pool: Map<string, PoolCard>): ParsedText {
  const byName = new Map<string, PoolCard>();
  for (const c of pool.values()) {
    for (const k of [listName(c), fullName(c), ...(c.type === "Legend" ? [c.name] : []), c.code, ...c.codes]) {
      if (!byName.has(norm(k))) byName.set(norm(k), c);
    }
  }
  // Nome sem o subtítulo só vale quando não há ambiguidade.
  const bare = new Map<string, PoolCard | null>();
  for (const c of pool.values()) bare.set(norm(c.name), bare.has(norm(c.name)) ? null : c);

  const deck = emptyDeck();
  const unknown: string[] = [];
  let section: Section | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\/\/.*$/, "").trim();
    if (!line) continue;
    const header = norm(line.replace(/:$/, "").replace(/\s*\(\d+\)\s*$/, ""));
    if (ALIASES[header]) {
      section = ALIASES[header];
      continue;
    }
    const m = line.match(/^(\d+)\s*x?\s+(.+)$/i) ?? line.match(/^(.+?)\s+x\s*(\d+)$/i);
    let count = 1;
    let label = line;
    if (m) {
      const [a, b] = /^\d+$/.test(m[1]!) ? [m[1]!, m[2]!] : [m[2]!, m[1]!];
      count = Number(a);
      label = b;
    }
    const key = norm(label);
    const c = byName.get(key) ?? bare.get(key) ?? null;
    if (!c || count <= 0) {
      unknown.push(raw.trim());
      continue;
    }
    const zone: Section =
      section === "side" || section === "extraLegends"
        ? section
        : c.type === "Legend"
          ? "legend"
          : c.type === "Rune"
            ? "runes"
            : c.type === "Battlefield"
              ? "battlefields"
              : section === "champion"
                ? "champion"
                : "main";
    if (zone === "legend") {
      if (!deck.legend) deck.legend = c.id;
      else deck.extraLegends.push(c.id);
    } else if (zone === "extraLegends") deck.extraLegends.push(c.id);
    else if (zone === "champion") {
      if (!deck.champion) {
        deck.champion = c.id;
        count -= 1;
      }
      if (count > 0) deck.main[c.id] = (deck.main[c.id] ?? 0) + count;
    } else if (zone === "battlefields") for (let i = 0; i < count; i++) deck.battlefields.push(c.id);
    else {
      const bucket = zone === "runes" ? deck.runes : zone === "side" ? deck.side : deck.main;
      bucket[c.id] = (bucket[c.id] ?? 0) + count;
    }
  }
  return { deck, unknown };
}
