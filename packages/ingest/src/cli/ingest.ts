/**
 * Importa os eventos acompanhados (ou só os ids passados) e recalcula as estatísticas.
 *   pnpm ingest            # todos os acompanhados
 *   pnpm ingest --live     # só os marcados como ao vivo
 *   pnpm ingest 857452     # um evento específico (precisa estar acompanhado)
 *   pnpm ingest --force    # rebaixa rodadas já completas
 */
import "./env";
import { parseArgs } from "node:util";
import { eq, inArray } from "drizzle-orm";
import { createDb, schema } from "@cr/db";
import { ingestEvent } from "../ingest-event";
import { recomputeStats } from "../recompute";
import { UvsClient } from "../uvs/client";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { live: { type: "boolean", default: false }, force: { type: "boolean", default: false }, "no-stats": { type: "boolean", default: false } },
});
const db = createDb();
const client = new UvsClient({ log: console.warn });

const tracked = positionals.length
  ? await db.select().from(schema.trackedEvent).where(inArray(schema.trackedEvent.uvsEventId, positionals.map(Number)))
  : values.live
    ? await db.select().from(schema.trackedEvent).where(eq(schema.trackedEvent.live, true))
    : await db.select().from(schema.trackedEvent);

if (!tracked.length) {
  console.log("Nenhum evento acompanhado. Use: pnpm track add <id>");
  process.exit(0);
}

const started = Date.now();
let failures = 0;
for (const t of tracked) {
  console.log(`Evento ${t.uvsEventId}…`);
  try {
    const r = await ingestEvent(db, client, t.uvsEventId, {
      kind: t.kind,
      metagameOverride: t.metagameOverride,
      force: values.force,
      log: console.log,
    });
    console.log(`  ${r.event} [${r.metagame ?? "?"}]: ${r.matches} partidas, ${r.standings} standings`);
    if (r.unknownLegends.length) console.warn(`  Lendas não reconhecidas: ${r.unknownLegends.join("; ")}`);
  } catch (err) {
    failures++;
    console.error(`  Falhou: ${(err as Error).message}`);
  }
}
console.log(`${client.requests} requisições à UVS em ${Math.round((Date.now() - started) / 1000)}s`);

if (!values["no-stats"]) await recomputeStats(db, console.log);
process.exit(failures ? 1 : 0);
