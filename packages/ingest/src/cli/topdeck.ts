/**
 * Importa do TopDeck.gg os torneios grandes de Riftbound (Showdowns, Regionals, majors)
 * e as decklists. Evento que já veio da UVS só recebe as decklists; o resto entra inteiro.
 *   pnpm topdeck                     # terminados nos últimos 30 dias, só os novos
 *   pnpm topdeck --since 2025-10-01  # desde a data (primeira carga)
 *   pnpm topdeck --dry-run           # só lista
 *   pnpm topdeck --force             # reimporta os já importados
 *   pnpm topdeck <tid> …             # torneios específicos
 * Precisa de TOPDECK_API_KEY. Correções à mão em topdeck-events.json:
 * "ignore" (tids que nunca entram) e "link" (tid → id do evento na UVS).
 */
import "./env";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { createDb } from "@cr/db";
import { recomputeStats } from "../recompute";
import { TopdeckClient } from "../topdeck/client";
import { findTopdeckMajors, importedTopdeckTids, importTopdeckEvent, type TopdeckMajor } from "../topdeck/import";
import { classifyTopdeck } from "../topdeck/normalize";
import { tdBulk } from "../topdeck/schemas";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    since: { type: "string" },
    days: { type: "string", default: "30" },
    "dry-run": { type: "boolean", default: false },
    force: { type: "boolean", default: false },
    "no-stats": { type: "boolean", default: false },
  },
});

if (!process.env.TOPDECK_API_KEY) {
  console.log("Defina o segredo TOPDECK_API_KEY (chave grátis do TopDeck.gg) para importar do TopDeck.");
  process.exit(0);
}

const config = JSON.parse(readFileSync(new URL("../../topdeck-events.json", import.meta.url), "utf8")) as { ignore: string[]; link: Record<string, number> };
const client = new TopdeckClient({ log: console.warn });

let majors: TopdeckMajor[];
if (positionals.length) {
  const res = await client.request("v2/tournaments", (d) => tdBulk.parse(d), { TID: positionals, columns: ["id"] });
  majors = res.map((t) => ({
    tid: t.TID,
    name: t.tournamentName,
    startsAt: new Date(t.startDate * 1000),
    players: t.standings.length,
    kind: classifyTopdeck(t.tournamentName, t.standings.length) ?? "showdown",
    swissNum: t.swissNum ?? null,
    topCut: t.topCut || null,
    address: [t.eventData?.city, t.eventData?.state].filter(Boolean).join(", ") || null,
  }));
} else {
  const since = values.since ? new Date(values.since) : new Date(Date.now() - Number(values.days) * 86_400_000);
  majors = await findTopdeckMajors(client, { since, ignore: config.ignore });
}

if (values["dry-run"]) {
  for (const t of majors) console.log(`${t.tid}\t${t.startsAt.toISOString().slice(0, 10)}\t${t.kind}\t${t.players}\t${t.name}`);
  console.log(`${majors.length} torneios grandes no TopDeck (${client.requests} requisições)`);
  process.exit(0);
}

const db = createDb();
const done = values.force || positionals.length ? new Set<string>() : await importedTopdeckTids(db);
let failures = 0;
let ownAdded = 0;
for (const t of majors.filter((m) => !done.has(m.tid))) {
  console.log(`${t.tid} — ${t.name} (${t.players})…`);
  try {
    const r = await importTopdeckEvent(db, client, t, { link: config.link, log: console.log });
    if (r.own) ownAdded++;
    console.log(
      `  ${r.own ? "evento novo" : `casou com o evento ${r.eventId} da UVS`}: ${r.decks} decklists, ${r.converted} com código, ${r.linkedPlayers} ligadas a jogadores` +
        (r.unknownLines ? `, ${r.unknownLines} linhas não reconhecidas` : ""),
    );
  } catch (err) {
    failures++;
    console.error(`  Falhou: ${(err as Error).message}`);
  }
}
console.log(`${client.requests} requisições ao TopDeck`);
// Só eventos novos mudam as estatísticas; decklists não entram nelas.
if (ownAdded && !values["no-stats"]) await recomputeStats(db, console.log);
process.exit(failures ? 1 : 0);
