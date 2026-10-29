import { isBanned, copyLimit } from "../deck/rules";
import type { PoolCard } from "../deck/types";
import type { Domain } from "./types";

/**
 * Busca com sintaxe, no espírito do Scryfall:
 *   jinx t:unit d:fury c<=3 m>=4 o:"draw a card" -is:signature tag:zaun set:OGN
 * Termos se somam (E); "or" separa alternativas; "-" nega um termo.
 */
export type QueryField = "any" | "name" | "text" | "type" | "domain" | "identity" | "cost" | "power" | "might" | "tag" | "set" | "is" | "rarity";
export type QueryOp = ":" | "=" | "!=" | "<" | ">" | "<=" | ">=";

export interface QueryTerm {
  field: QueryField;
  op: QueryOp;
  value: string;
  negate: boolean;
}

export interface ParsedQuery {
  /** Alternativas (OU); cada uma é uma lista de termos (E). */
  groups: QueryTerm[][];
  /** Trechos que não entendemos, para mostrar ao usuário. */
  errors: string[];
}

const FIELDS: Record<string, QueryField> = {
  n: "name",
  name: "name",
  nome: "name",
  o: "text",
  text: "text",
  texto: "text",
  t: "type",
  type: "type",
  tipo: "type",
  d: "domain",
  domain: "domain",
  dominio: "domain",
  id: "identity",
  identity: "identity",
  identidade: "identity",
  c: "cost",
  e: "cost",
  cost: "cost",
  energy: "cost",
  custo: "cost",
  p: "power",
  power: "power",
  poder: "power",
  m: "might",
  might: "might",
  forca: "might",
  tag: "tag",
  tg: "tag",
  s: "set",
  set: "set",
  is: "is",
  r: "rarity",
  rarity: "rarity",
  raridade: "rarity",
};

const NUMERIC = new Set<QueryField>(["cost", "power", "might"]);

const DOMAIN_ALIASES: Record<string, Domain> = {
  fury: "Fury", furia: "Fury", red: "Fury",
  calm: "Calm", calma: "Calm", green: "Calm",
  mind: "Mind", mente: "Mind", blue: "Mind",
  body: "Body", corpo: "Body", orange: "Body",
  chaos: "Chaos", caos: "Chaos", purple: "Chaos",
  order: "Order", ordem: "Order", yellow: "Order",
};

const TYPE_ALIASES: Record<string, string> = {
  unit: "unit", unidade: "unit",
  spell: "spell", feitico: "spell", magia: "spell",
  gear: "gear", equipamento: "gear",
  rune: "rune", runa: "rune",
  battlefield: "battlefield", campo: "battlefield", bf: "battlefield",
  legend: "legend", lenda: "legend",
  champion: "champion", campeao: "champion", campea: "champion",
  signature: "signature", assinatura: "signature",
  token: "token", basic: "basic", basica: "basic",
};

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’‘`]/g, "'")
    .toLowerCase();

/** Separa a busca em pedaços, respeitando aspas: o:"draw a card" vira um pedaço só. */
function tokenize(q: string): string[] {
  const out: string[] = [];
  const re = /(-?[\p{L}]+(?:!=|<=|>=|[:=<>])"[^"]*"?)|(-?"[^"]*"?)|(\S+)/gu;
  for (const m of q.matchAll(re)) out.push(m[0]);
  return out;
}

export function parseCardQuery(q: string): ParsedQuery {
  const groups: QueryTerm[][] = [[]];
  const errors: string[] = [];
  for (const raw of tokenize(q)) {
    if (/^or$/i.test(raw) || raw === "|") {
      if (groups.at(-1)!.length) groups.push([]);
      continue;
    }
    let tok = raw;
    let negate = false;
    if (tok.startsWith("-") && tok.length > 1) {
      negate = true;
      tok = tok.slice(1);
    }
    const m = tok.match(/^([\p{L}]+)(!=|<=|>=|[:=<>])(.*)$/u);
    if (m && FIELDS[fold(m[1]!)]) {
      const field = FIELDS[fold(m[1]!)]!;
      const op = m[2] as QueryOp;
      const value = m[3]!.replace(/^"|"$/g, "");
      if (!value) {
        errors.push(raw);
        continue;
      }
      if (NUMERIC.has(field) && !/^\d+$/.test(value)) {
        errors.push(raw);
        continue;
      }
      if (!NUMERIC.has(field) && !(op === ":" || op === "=" || op === "!=")) {
        errors.push(raw);
        continue;
      }
      if ((field === "domain" || field === "identity") && !value.split(/[,+]/).every((v) => DOMAIN_ALIASES[fold(v)] || ["none", "neutral", "nenhum", "neutro"].includes(fold(v)))) {
        errors.push(raw);
        continue;
      }
      groups.at(-1)!.push({ field, op: op === "=" && !NUMERIC.has(field) ? ":" : op, value, negate });
      continue;
    }
    if (m && !FIELDS[fold(m[1]!)] && m[2] !== ":") {
      // Algo como "abc<3": não é campo conhecido.
      errors.push(raw);
      continue;
    }
    const value = tok.replace(/^"|"$/g, "");
    if (value) groups.at(-1)!.push({ field: "any", op: ":", value, negate });
  }
  return { groups: groups.filter((g) => g.length), errors };
}

const cmp = (a: number | null, op: QueryOp, b: number) => {
  if (a === null) return false;
  switch (op) {
    case "<": return a < b;
    case ">": return a > b;
    case "<=": return a <= b;
    case ">=": return a >= b;
    case "!=": return a !== b;
    default: return a === b;
  }
};

const domainsOf = (v: string): Domain[] | "none" => {
  const parts = v.split(/[,+]/).map(fold);
  if (parts.some((p) => ["none", "neutral", "nenhum", "neutro"].includes(p))) return "none";
  return parts.map((p) => DOMAIN_ALIASES[p]!).filter(Boolean);
};

function matchTerm(c: PoolCard, t: QueryTerm): boolean {
  const v = fold(t.value);
  switch (t.field) {
    case "any":
      return fold(`${c.name} ${c.subtitle ?? ""} ${c.rulesText} ${c.tags.join(" ")}`).includes(v);
    case "name":
      return fold(`${c.name} ${c.subtitle ?? ""}`).includes(v);
    case "text":
      return fold(c.rulesText).includes(v);
    case "type": {
      const want = TYPE_ALIASES[v] ?? v;
      return fold(c.type ?? "") === want || c.supertypes.some((s) => fold(s) === want);
    }
    case "domain": {
      const ds = domainsOf(t.value);
      if (ds === "none") return c.domains.length === 0;
      return t.op === "!=" ? !ds.every((d) => c.domains.includes(d)) : ds.every((d) => c.domains.includes(d));
    }
    case "identity": {
      const ds = domainsOf(t.value);
      const allowed = ds === "none" ? [] : ds;
      return c.domains.every((d) => allowed.includes(d));
    }
    case "cost":
      return cmp(c.energyCost, t.op, Number(v));
    case "power":
      return cmp(c.powerCost, t.op, Number(v));
    case "might":
      return cmp(c.might, t.op, Number(v));
    case "tag":
      return c.tags.some((g) => fold(g) === v || fold(g).includes(v));
    case "set":
      return fold(c.setId) === v || c.codes.some((k) => fold(k).startsWith(`${v}-`));
    case "rarity":
      return fold(c.rarity ?? "").startsWith(v);
    case "is":
      if (v === "banned" || v === "banida") return isBanned(c);
      if (v === "unique" || v === "unica") return copyLimit(c) === 1;
      if (v === "neutral" || v === "neutra") return c.domains.length === 0;
      return c.supertypes.some((s) => fold(s) === (TYPE_ALIASES[v] ?? v));
  }
}

export function matchCard(c: PoolCard, q: ParsedQuery): boolean {
  if (!q.groups.length) return true;
  return q.groups.some((g) =>
    g.every((t) => {
      const hit = matchTerm(c, t);
      const neg = t.negate !== (t.op === "!=" && t.field !== "domain" && !NUMERIC.has(t.field));
      return neg ? !hit : hit;
    }),
  );
}
