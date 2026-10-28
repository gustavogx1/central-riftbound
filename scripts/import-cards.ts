/**
 * Lê o cards.json (galeria oficial) e gera data/generated/catalog.json,
 * que o seed do banco e o build do site usam.
 *
 *   pnpm import:cards [caminho/para/cards.json]
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { normalizeCatalog, type RawCard } from "@cr/core";

const source = resolve(process.argv[2] ?? process.env.CARDS_SOURCE ?? "data/source/cards.json");
const target = resolve("data/generated/catalog.json");

const rows = JSON.parse(await readFile(source, "utf8")) as RawCard[];
const catalog = normalizeCatalog(rows);

await mkdir(dirname(target), { recursive: true });
await writeFile(target, JSON.stringify(catalog));

// Só contagens: o site mostra os números na home sem precisar do catálogo no repositório.
const summary = { cards: catalog.cards.length, legends: catalog.legends.length, sets: catalog.sets.length };
await writeFile(resolve("apps/web/src/generated/catalog-summary.json"), `${JSON.stringify(summary)}\n`);

const missingType = catalog.cards.filter((c) => c.type === null).length;
console.log(
  `${rows.length} linhas → ${catalog.cards.length} cartas, ${catalog.prints.length} impressões, ` +
    `${catalog.legends.length} lendas, ${catalog.sets.length} sets (${missingType} sem tipo)`,
);
console.log(`Gravado em ${target}`);
