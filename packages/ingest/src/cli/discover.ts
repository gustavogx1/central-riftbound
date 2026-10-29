/**
 * Acha os eventos do Showdown Series na UVS e passa a acompanhá-los.
 * Roda todo dia antes da importação, então Showdowns novos entram sozinhos.
 *   pnpm discover            # cadastra os novos
 *   pnpm discover --dry-run  # só lista
 * Para nunca acompanhar um evento achado por engano, ponha o id em showdown-ignore.json.
 */
import "./env";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { createDb } from "@cr/db";
import { findShowdowns, trackShowdowns } from "../showdown";
import { UvsClient } from "../uvs/client";

const { values } = parseArgs({ options: { "dry-run": { type: "boolean", default: false } } });
const ignore = JSON.parse(readFileSync(new URL("../../showdown-ignore.json", import.meta.url), "utf8")) as number[];
const client = new UvsClient({ log: console.warn });

const { found, added } = values["dry-run"]
  ? { found: (await findShowdowns(client)).filter((e) => !ignore.includes(e.id)), added: [] as number[] }
  : await trackShowdowns(createDb(), client, { ignore });
const isNew = new Set(added);
for (const e of found) {
  console.log(`${isNew.has(e.id) ? "+" : " "} ${e.id}\t${e.start_datetime.slice(0, 10)}\t${e.kind}\t${e.starting_player_count ?? "?"}\t${e.name}`);
}
console.log(`${found.length} Showdowns na UVS, ${added.length} novos acompanhados`);
process.exit(0);
