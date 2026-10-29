import { getStatScopes, METAGAMES, type Kind } from "./queries";

const KINDS: Kind[] = ["main", "showdown", "all"];

/**
 * Escolhe set e tipo de evento. O que vier na URL vale; o que faltar vira o primeiro recorte com
 * dados, do set mais novo ao mais antigo e de RQs para Showdowns e depois todos os eventos. Assim,
 * num set que ainda não teve RQ (só Showdowns), a página abre com os Showdowns em vez de vazia.
 */
export function pickScope(scopes: Set<string>, rawSet: string | undefined, rawKind: string | undefined) {
  const metas = new Set([...scopes].map((s) => s.split(":")[0]!));
  const metagames: string[] = METAGAMES.filter((m) => metas.has(m));
  const setOk = rawSet !== undefined && (rawSet === "all" || metagames.includes(rawSet));
  const kindOk = rawKind !== undefined && (KINDS as string[]).includes(rawKind);
  const sets = setOk ? [rawSet] : [...metagames, "all"];
  const kinds = kindOk ? [rawKind as Kind] : KINDS;
  for (const m of sets) for (const k of kinds) if (scopes.has(`${m}:${k}`)) return { metagames, meta: m, kind: k, scope: `${m}:${k}` };
  const meta = setOk ? rawSet : (metagames[0] ?? "all");
  const kind: Kind = kindOk ? (rawKind as Kind) : "main";
  return { metagames, meta, kind, scope: `${meta}:${kind}` };
}

/** Lê ?set= e ?kind= e devolve o escopo das estatísticas ("VEN:main").
 * Tipos: main (RQs), showdown (Showdown Series) e all (inclui paralelos). */
export async function resolveScope(searchParams: Record<string, string | string[] | undefined>) {
  const rawSet = typeof searchParams.set === "string" ? searchParams.set : undefined;
  const rawKind = typeof searchParams.kind === "string" ? searchParams.kind : undefined;
  return pickScope(await getStatScopes(), rawSet, rawKind);
}
