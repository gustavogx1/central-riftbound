import { type Db, schema } from "@cr/db";
import type { UvsClient } from "./uvs/client";
import { uvsEventSearch, type UvsEventSummary } from "./uvs/schemas";

/**
 * Showdown Series: torneios abertos de organizadores parceiros, chancelados pela
 * Riot e cadastrados na UVS. O menor nível (Tier III) começa em 128 jogadores;
 * abaixo disso o nome "Showdown" costuma ser só o apelido de um evento de loja.
 */
export const SHOWDOWN_MIN_PLAYERS = 128;
/** Eventos paralelos (grinders, rebounds, "daily") no mesmo fim de semana. */
export const SHOWDOWN_SIDE_MIN_PLAYERS = 64;

const SIDE = /grinder|rebound|daily|pre-?showdown|last chance|side event|trial/i;
/** Formatos limitados não entram: o meta é de construído. */
const LIMITED = /sealed|draft|booster|pre-?con/i;

/**
 * Tamanho que conta para a regra. Antes de começar, a UVS ainda não tem o total
 * (quem se inscreve fora dela aparece só no dia), então vale a capacidade.
 */
export function showdownSize(e: UvsEventSummary): number {
  const started = e.starting_player_count ?? 0;
  if (e.display_status === "complete") return started;
  return Math.max(started, e.registered_user_count ?? 0, e.capacity ?? 0);
}

/** Regional Qualifier / Regional Championship da Riot: milhares de jogadores. */
export const REGIONAL_MIN_PLAYERS = 256;
const REGIONAL_MAIN = /regional (qualifier|championship)/i;
/** Pre-Regional Challenge e Regional Rebound, no mesmo fim de semana. */
const REGIONAL_SIDE = /pre-?regional|regional rebound/i;
/** "Road to Regionals" e afins são eventos de loja. */
const REGIONAL_STORE = /road to/i;

/** "main" (Regional), "side" (paralelo do Regional) ou null (fora). */
export function classifyRegional(e: UvsEventSummary): "main" | "side" | null {
  if (e.game_type !== "RIFTBOUND" || e.is_test_event) return null;
  if (LIMITED.test(e.name) || REGIONAL_STORE.test(e.name)) return null;
  if (e.gameplay_format && e.gameplay_format.name !== "Constructed") return null;
  const size = showdownSize(e);
  if (REGIONAL_SIDE.test(e.name)) return size >= SHOWDOWN_SIDE_MIN_PLAYERS ? "side" : null;
  if (REGIONAL_MAIN.test(e.name)) return size >= REGIONAL_MIN_PLAYERS ? "main" : null;
  return null;
}

/** "showdown" (principal), "side" (paralelo) ou null (fora). */
export function classifyShowdown(e: UvsEventSummary): "showdown" | "side" | null {
  if (e.game_type !== "RIFTBOUND" || e.is_test_event) return null;
  if (!/showdown/i.test(e.name) || LIMITED.test(e.name)) return null;
  if (e.gameplay_format && e.gameplay_format.name !== "Constructed") return null;
  const size = showdownSize(e);
  if (SIDE.test(e.name)) return size >= SHOWDOWN_SIDE_MIN_PLAYERS ? "side" : null;
  return size >= SHOWDOWN_MIN_PLAYERS ? "showdown" : null;
}

type MajorKind = "showdown" | "main" | "side";

/** Termo buscado no nome → regra que decide se o evento entra. */
const SEARCHES: [string, (e: UvsEventSummary) => MajorKind | null][] = [
  ["Showdown", classifyShowdown],
  ["Regional", classifyRegional],
];

/**
 * Busca na UVS os eventos com "Showdown" ou "Regional" no nome (são poucas
 * centenas, de todos os jogos, então 1 ou 2 requisições por termo) e devolve os
 * que entram: Showdowns, Regionais e os paralelos deles.
 */
export async function findShowdowns(client: UvsClient) {
  const found = new Map<number, UvsEventSummary & { start_datetime: string; kind: MajorKind }>();
  for (const [name, classify] of SEARCHES) {
    for (let p = 1; ; p++) {
      const res = await client.get(`events/?page=${p}&page_size=250&name=${name}`, (d) => uvsEventSearch.parse(d));
      for (const e of res.results) {
        const kind = classify(e);
        if (kind && e.start_datetime && !found.has(e.id)) found.set(e.id, { ...e, start_datetime: e.start_datetime, kind });
      }
      if (!res.next) break;
    }
  }
  return [...found.values()].sort((a, b) => a.start_datetime.localeCompare(b.start_datetime));
}

/**
 * Passa a acompanhar os Showdowns e Regionais novos. Quem já está na lista não muda (um
 * evento cadastrado à mão com outro tipo continua como está), e os ids em
 * `ignore` nunca entram.
 */
export async function trackShowdowns(db: Db, client: UvsClient, opts: { ignore?: number[] } = {}) {
  const ignore = new Set(opts.ignore ?? []);
  const found = (await findShowdowns(client)).filter((e) => !ignore.has(e.id));
  if (!found.length) return { found, added: [] as number[] };
  const added = await db
    .insert(schema.trackedEvent)
    .values(found.map((e) => ({ uvsEventId: e.id, kind: e.kind })))
    .onConflictDoNothing()
    .returning({ id: schema.trackedEvent.uvsEventId });
  return { found, added: added.map((r) => r.id) };
}
