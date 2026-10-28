/**
 * Sugere eventos grandes para acompanhar, buscando pelo nome na API da UVS.
 *   pnpm suggest ["Regional Qualifier"] [--min 500]
 */
import "./env";
import { parseArgs } from "node:util";
import { UvsClient } from "../uvs/client";
import { uvsEventList } from "../uvs/schemas";

const { positionals, values } = parseArgs({ allowPositionals: true, options: { min: { type: "string", default: "500" } } });
const names = positionals.length ? positionals : ["Regional Qualifier", "Pre-Regional Challenge", "Regional Rebound", "Showdown"];
const client = new UvsClient();

for (const name of names) {
  const res = await client.get(`events/?page=1&page_size=100&name=${encodeURIComponent(name)}`, (d) => uvsEventList.parse(d));
  const big = res.results
    .filter((e) => (e.starting_player_count ?? 0) >= Number(values.min))
    .sort((a, b) => a.start_datetime.localeCompare(b.start_datetime));
  console.log(`\n${name}: ${big.length} com ${values.min}+ jogadores (de ${res.count})`);
  for (const e of big) console.log(`  ${e.id}\t${e.start_datetime.slice(0, 10)}\t${e.starting_player_count}\t${e.display_status}\t${e.name}`);
}
