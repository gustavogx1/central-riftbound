import { getAvailableMetagames, type Kind } from "./queries";

/** Lê ?set= e ?kind= e devolve o escopo das estatísticas ("VEN:main"). Padrão: set mais novo com dados, só RQs.
 * Tipos: main (RQs), showdown (Showdown Series) e all (inclui paralelos). */
export async function resolveScope(searchParams: Record<string, string | string[] | undefined>) {
  const metagames = await getAvailableMetagames();
  const rawSet = typeof searchParams.set === "string" ? searchParams.set : undefined;
  const rawKind = typeof searchParams.kind === "string" ? searchParams.kind : undefined;
  const meta = rawSet && (rawSet === "all" || metagames.includes(rawSet)) ? rawSet : (metagames[0] ?? "all");
  const kind: Kind = rawKind === "all" || rawKind === "showdown" ? rawKind : "main";
  return { metagames, meta, kind, scope: `${meta}:${kind}` };
}
