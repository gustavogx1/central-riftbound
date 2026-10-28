/**
 * Grava um evento terminado da UVS para o simulador (pnpm simulate).
 *   pnpm record 1233879 [--out data/recordings]
 * A gravação tem nomes públicos de jogadores: fica fora do git (data/).
 */
import "./env";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import type { Recording } from "../replay";
import { UvsClient } from "../uvs/client";
import { uvsEvent } from "../uvs/schemas";

const { positionals, values } = parseArgs({ allowPositionals: true, options: { out: { type: "string", default: "data/recordings" } } });
const id = Number(positionals[0]);
if (!id) {
  console.log("Uso: pnpm record <id do evento>");
  process.exit(1);
}
const client = new UvsClient({ log: console.warn });
const rawPage = z.object({ next: z.number().nullable(), results: z.array(z.record(z.string(), z.unknown())) });

async function all(path: string) {
  const out: Record<string, unknown>[] = [];
  for (let p = 1; ; p++) {
    const d = await client.get(`${path}?page=${p}&page_size=500`, (x) => rawPage.parse(x));
    out.push(...d.results);
    if (!d.next) return out;
  }
}

const raw = await client.get(`events/${id}/`, (d) => d as Record<string, unknown>);
const ev = uvsEvent.parse(raw);
if (ev.display_status !== "complete") console.warn(`Aviso: o evento está "${ev.display_status}"; a gravação fica incompleta.`);
const rec: Recording = { event: raw as Recording["event"], rounds: {} };
for (const p of ev.tournament_phases) {
  for (const r of p.rounds) {
    const matches = r.pairings_status === "GENERATED" ? await all(`tournament-rounds/${r.id}/matches/paginated/`) : [];
    const standings = r.standings_status === "GENERATED" ? await all(`tournament-rounds/${r.id}/standings/paginated/`) : [];
    rec.rounds[String(r.id)] = { matches: matches as Recording["rounds"][string]["matches"], standings };
    console.log(`  ${p.phase_name} #${r.round_number}: ${matches.length} partidas, ${standings.length} standings`);
  }
}
// O pnpm roda o script dentro de packages/ingest; grava a partir da raiz do repo.
const dir = resolve(process.env.INIT_CWD ?? process.cwd(), values.out);
mkdirSync(dir, { recursive: true });
const file = join(dir, `${id}.json`);
writeFileSync(file, JSON.stringify(rec));
console.log(`${ev.name}: gravado em ${file} (${client.requests} requisições)`);
