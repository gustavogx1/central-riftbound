/**
 * Gerencia a lista de eventos acompanhados.
 *   pnpm track add 857452 [--kind main|side|community] [--name "RQ Barcelona"] [--metagame VEN] [--live]
 *   pnpm track live 857452 on|off
 *   pnpm track list
 *   pnpm track seed            # cadastra a lista inicial de tracked-events.json (não mexe nos já cadastrados)
 */
import "./env";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { createDb, schema } from "@cr/db";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { kind: { type: "string", default: "main" }, name: { type: "string" }, metagame: { type: "string" }, live: { type: "boolean", default: false } },
});
const [cmd, id, flag] = positionals;
const db = createDb();

if (cmd === "add" && id) {
  for (const raw of [id, ...positionals.slice(2)]) {
    const uvsEventId = Number(raw);
    await db
      .insert(schema.trackedEvent)
      .values({ uvsEventId, kind: values.kind as "main", displayName: values.name ?? null, metagameOverride: values.metagame ?? null, live: values.live })
      .onConflictDoUpdate({ target: schema.trackedEvent.uvsEventId, set: { kind: values.kind as "main", ...(values.live ? { live: true } : {}) } });
    console.log(`Acompanhando ${uvsEventId} (${values.kind}${values.live ? ", ao vivo" : ""})`);
  }
} else if (cmd === "seed") {
  const rows = JSON.parse(readFileSync(new URL("../../tracked-events.json", import.meta.url), "utf8")) as { uvsEventId: number; kind: "main" | "side" | "showdown" }[];
  const added = await db.insert(schema.trackedEvent).values(rows).onConflictDoNothing().returning({ id: schema.trackedEvent.uvsEventId });
  console.log(`${added.length} eventos novos (${rows.length} na lista)`);
} else if (cmd === "live" && id) {
  await db.update(schema.trackedEvent).set({ live: flag === "on" }).where(eq(schema.trackedEvent.uvsEventId, Number(id)));
  console.log(`${id}: ao vivo ${flag === "on" ? "ligado" : "desligado"}`);
} else {
  const rows = await db.select().from(schema.trackedEvent).orderBy(schema.trackedEvent.addedAt);
  for (const r of rows) console.log(`${r.uvsEventId}\t${r.kind}\t${r.live ? "AO VIVO" : ""}\t${r.displayName ?? ""}`);
  console.log(`${rows.length} eventos`);
}
process.exit(0);
