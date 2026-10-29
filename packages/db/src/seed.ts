import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Catalog } from "@cr/core";
import { eq, sql } from "drizzle-orm";
import { createDb, schema } from "./index";

const ENV_FILE = resolve(import.meta.dirname, "../../../.env");
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

const CATALOG = resolve(import.meta.dirname, "../../../data/generated/catalog.json");
const CHUNK = 500;

/** Tabelas com FK para legend.slug (coluna `legend`). */
const LEGEND_FK_TABLES = ["legend_stats", "complexity_vote"] as const;

/** Colunas sem FK que guardam o slug de uma lenda. */
const LEGEND_REFS = [
  ["match", "legend1"],
  ["match", "legend2"],
  ["standing", "legend"],
  ["unknown_legend_name", "legend_slug"],
  ["matchup_stats", "legend"],
  ["matchup_stats", "opponent"],
  ["pilot_stats", "legend"],
  ["power_snapshot", "legend"],
] as const;

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
    // Lenda cujo slug mudou (ex.: "yordle-heart-of-the-tempest" virou "kennen-heart-of-the-tempest"):
    // troca o slug na linha existente e em tudo que aponta para ela, antes do upsert.
    const newSlug = new Map(catalog.legends.map((l) => [l.cardId, l.slug]));
    const existing = await tx.select({ slug: schema.legend.slug, cardId: schema.legend.cardId }).from(schema.legend);
    for (const { slug: from, cardId } of existing) {
      const to = newSlug.get(cardId);
      if (!to || to === from) continue;
      // As FKs não têm ON UPDATE CASCADE: guarda as linhas que referenciam, troca o slug e devolve.
      for (const table of LEGEND_FK_TABLES) {
        const stash = sql.identifier(`moved_${table}`);
        await tx.execute(sql`create temp table ${stash} as select * from ${sql.identifier(table)} where legend = ${from}`);
        await tx.execute(sql`delete from ${sql.identifier(table)} where legend = ${from}`);
      }
      await tx.update(schema.legend).set({ slug: to }).where(eq(schema.legend.slug, from));
      for (const table of LEGEND_FK_TABLES) {
        const stash = sql.identifier(`moved_${table}`);
        await tx.execute(sql`update ${stash} set legend = ${to}`);
        await tx.execute(sql`insert into ${sql.identifier(table)} select * from ${stash}`);
        await tx.execute(sql`drop table ${stash}`);
      }
      for (const [table, column] of LEGEND_REFS) {
        await tx.execute(sql`update ${sql.identifier(table)} set ${sql.identifier(column)} = ${to} where ${sql.identifier(column)} = ${from}`);
      }
      console.log(`Lenda renomeada: ${from} → ${to}`);
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
