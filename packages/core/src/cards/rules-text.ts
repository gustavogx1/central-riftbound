import { DOMAINS, type Domain } from "./types";

/** Pedaço do texto de regras pronto para renderizar com ícones próprios. */
export type RulesToken =
  | { kind: "text"; value: string }
  | { kind: "energy"; amount: number }
  | { kind: "power"; domain: Domain | "Any" }
  | { kind: "might" }
  | { kind: "exhaust" }
  | { kind: "arrow"; nested: boolean }
  | { kind: "keyword"; name: string; value: number | null };

const MARKER = /\[([^\]]+)\]/g;

function classify(inner: string): RulesToken {
  const energy = /^(\d+) Energy$/.exec(inner);
  if (energy) return { kind: "energy", amount: Number(energy[1]) };
  const power = /^(\w+) Power$/.exec(inner);
  if (power) {
    const d = power[1]!;
    if (d === "Any") return { kind: "power", domain: "Any" };
    if ((DOMAINS as readonly string[]).includes(d)) return { kind: "power", domain: d as Domain };
  }
  if (inner === "Might") return { kind: "might" };
  if (inner === "Exhaust") return { kind: "exhaust" };
  if (inner === ">") return { kind: "arrow", nested: false };
  if (inner === ">>") return { kind: "arrow", nested: true };
  const kw = /^(.+?)(?: (\d+))?$/.exec(inner)!;
  return { kind: "keyword", name: kw[1]!, value: kw[2] ? Number(kw[2]) : null };
}

export function tokenizeRulesText(text: string): RulesToken[] {
  const out: RulesToken[] = [];
  let last = 0;
  for (const m of text.matchAll(MARKER)) {
    if (m.index > last) out.push({ kind: "text", value: text.slice(last, m.index) });
    out.push(classify(m[1]!));
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", value: text.slice(last) });
  return out;
}
