/**
 * Ao vivo: atualiza os eventos marcados como ao vivo.
 *   pnpm live                    # uma passada (o que o pg_cron chama a cada 2 min)
 *   pnpm live --watch [--every 60]  # repete até não sobrar evento ao vivo
 *   pnpm live --arm              # liga o ao vivo dos acompanhados que começam em até 36 h
 */
import "./env";
import { parseArgs } from "node:util";
import { createDb } from "@cr/db";
import { armLiveEvents, liveTick } from "../live";
import { UvsClient } from "../uvs/client";

const { values } = parseArgs({
  options: { watch: { type: "boolean", default: false }, every: { type: "string", default: "60" }, arm: { type: "boolean", default: false } },
});
const db = createDb();
const client = new UvsClient({ log: console.warn });

if (values.arm) {
  const ids = await armLiveEvents(db);
  console.log(ids.length ? `Ao vivo ligado: ${ids.join(", ")}` : "Nenhum evento acompanhado começa nas próximas 36 h");
  process.exit(0);
}

for (;;) {
  const results = await liveTick(db, client, { log: console.log });
  if (!values.watch) process.exit(results.some((r) => r.action === "error") ? 1 : 0);
  if (!results.length || results.every((r) => r.action === "finished" || r.action === "expire")) {
    console.log("Nenhum evento ao vivo; parando.");
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, Number(values.every) * 1000));
}
