/**
 * Preenche o nick dos jogadores nos eventos já importados antes de o site guardar nicks.
 * Lê só a classificação final de cada fase (poucas requisições por evento) e pula
 * eventos que já têm nick gravado.
 *   pnpm nicks            # eventos sem nenhum nick
 *   pnpm nicks --all      # todos os eventos importados
 */
import "./env";
import { parseArgs } from "node:util";
import { sql } from "drizzle-orm";
import { createDb, schema } from "@cr/db";
import { nickSet } from "../ingest-event";
import { playerFromStanding, roundRows } from "../normalize";
import { UvsClient } from "../uvs/client";
import { page, uvsEvent, uvsStanding } from "../uvs/schemas";

const { values } = parseArgs({ options: { all: { type: "boolean", default: false } } });
const db = createDb();
const client = new UvsClient({ log: console.warn });

const events = (await db.execute(sql`
  select e.id from event e
  where ${values.all} or not exists (
    select 1 from standing s join player p on p.id = s.player_id where s.event_id = e.id and p.nick is not null
  )
  order by e.starts_at
`)) as unknown as { id: number }[];

let updated = 0;
for (const { id } of events) {
  const ev = await client.get(`events/${id}/`, (d) => uvsEvent.parse(d));
  const startsAt = new Date(ev.start_datetime);
  const lastOfPhase = new Map<number, number>();
  for (const r of roundRows(ev)) if (r.standingsReady) lastOfPhase.set(r.phaseId, r.id);
  for (const roundId of lastOfPhase.values()) {
    for (let p = 1; ; p++) {
      const data = await client.get(`tournament-rounds/${roundId}/standings/paginated/?page=${p}&page_size=500`, (d) => page(uvsStanding).parse(d));
      const rows = data.results.map((s) => playerFromStanding(s, startsAt)).filter((r) => r.nick);
      if (rows.length) {
        await db.insert(schema.player).values(rows).onConflictDoUpdate({ target: schema.player.id, set: nickSet });
        updated += rows.length;
      }
      if (!data.next) break;
    }
  }
  console.log(`  ${ev.name}: ok`);
}
console.log(`${events.length} eventos, ${updated} nicks gravados, ${client.requests} requisições à UVS`);
process.exit(0);
