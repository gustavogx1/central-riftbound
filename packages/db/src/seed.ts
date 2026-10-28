import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Catalog } from "@cr/core";
import { sql } from "drizzle-orm";
import { createDb, schema } from "./index";

const CATALOG = resolve(import.meta.dirname, "../../../data/generated/catalog.json");
const CHUNK = 500;

function chunks<T>(rows: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += CHUNK) out.push(rows.slice(i, i + CHUNK));
  return out;
}

async function main() {
  const catalog = JSON.parse(await readFile(CATALOG, "utf8")) as Catalog;
  const db = createDb();
  const excluded = (cols: string[]) =>
    Object.fromEntries(cols.map((c) => [c, sql.raw(`excluded.${c.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)}`)]));

  await db.transaction(async (tx) => {
    await tx.insert(schema.cardSet).values(catalog.sets)
      .onConflictDoUpdate({ target: schema.cardSet.id, set: excluded(["name", "printCount"]) });
    for (const rows of chunks(catalog.cards)) {
      await tx.insert(schema.card).values(rows).onConflictDoUpdate({
        target: schema.card.id,
        set: excluded(["name", "subtitle", "type", "supertypes", "tags", "domains", "energyCost", "powerCost", "might", "mightBonus", "rulesText", "effectText"]),
      });
    }
    for (const rows of chunks(catalog.prints)) {
      await tx.insert(schema.cardPrint).values(rows).onConflictDoUpdate({
        target: schema.cardPrint.id,
        set: excluded(["cardId", "code", "publicCode", "setId", "collectorNumber", "variant", "rarity", "artist", "orientation", "imageFile"]),
      });
    }
    await tx.insert(schema.legend).values(catalog.legends).onConflictDoUpdate({
      target: schema.legend.slug,
      set: excluded(["cardId", "champion", "title", "domains"]),
    });
  });

  console.log(`Seed ok: ${catalog.sets.length} sets, ${catalog.cards.length} cartas, ${catalog.prints.length} impressões, ${catalog.legends.length} lendas`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
