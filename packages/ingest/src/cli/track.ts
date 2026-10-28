/**
 * Gerencia a lista de eventos acompanhados.
 *   pnpm track add 857452 [--kind main|side|community] [--name "RQ Barcelona"] [--metagame VEN]
 *   pnpm track live 857452 on|off
 *   pnpm track list
 */
import "./env";
import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { createDb, schema } from "@cr/db";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { kind: { type: "string", default: "main" }, name: { type: "string" }, metagame: { type: "string" } },
});
const [cmd, id, flag] = positionals;
const db = createDb();

if (cmd === "add" && id) {
  for (const raw of [id, ...positionals.slice(2)]) {
    const uvsEventId = Number(raw);
    await db
      .insert(schema.trackedEvent)
      .values({ uvsEventId, kind: values.kind as "main", displayName: values.name ?? null, metagameOverride: values.metagame ?? null })
      .onConflictDoUpdate({ target: schema.trackedEvent.uvsEventId, set: { kind: values.kind as "main" } });
    console.log(`Acompanhando ${uvsEventId} (${values.kind})`);
  }
} else if (cmd === "live" && id) {
  await db.update(schema.trackedEvent).set({ live: flag === "on" }).where(eq(schema.trackedEvent.uvsEventId, Number(id)));
  console.log(`${id}: ao vivo ${flag === "on" ? "ligado" : "desligado"}`);
} else {
  const rows = await db.select().from(schema.trackedEvent).orderBy(schema.trackedEvent.addedAt);
  for (const r of rows) console.log(`${r.uvsEventId}\t${r.kind}\t${r.live ? "AO VIVO" : ""}\t${r.displayName ?? ""}`);
  console.log(`${rows.length} eventos`);
}
process.exit(0);
