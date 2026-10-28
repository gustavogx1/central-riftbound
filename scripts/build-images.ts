/**
 * Converte as imagens PNG das cartas em WebP (372px e 744px) e gera um
 * avatar redondo (256px) para cada Legend. O envio fica em scripts/upload-images.ts.
 *
 *   pnpm build:images [pasta/imagens]
 * A pasta pode ter um manifest.json (id → arquivo) ou ser a pasta images/ do
 * scrape_cards.py --images, com um PNG por código público (OGN-001_298.png).
 */
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Catalog } from "@cr/core";
import sharp from "sharp";

interface ManifestRow { id: string; file: string }

const source = resolve(process.argv[2] ?? process.env.IMAGES_SOURCE ?? "data/source/imagens");
const out = resolve("data/images");
const catalog = JSON.parse(await readFile(resolve("data/generated/catalog.json"), "utf8")) as Catalog;
const manifestPath = join(source, "manifest.json");
const fileById = existsSync(manifestPath)
  ? new Map((JSON.parse(await readFile(manifestPath, "utf8")) as ManifestRow[]).map((m) => [m.id, m.file]))
  : new Map(catalog.prints.map((p) => [p.id, `${p.publicCode.replace(/[^\w.-]/g, "_")}.png`]));
const legendCards = new Set(catalog.legends.map((l) => l.cardId));

for (const size of [372, 744]) await mkdir(join(out, String(size)), { recursive: true });
await mkdir(join(out, "avatar"), { recursive: true });

const AVATAR = 256;
const circle = Buffer.from(`<svg width="${AVATAR}" height="${AVATAR}"><circle cx="${AVATAR / 2}" cy="${AVATAR / 2}" r="${AVATAR / 2}"/></svg>`);

let done = 0;
let skipped = 0;
const missing: string[] = [];

for (const print of catalog.prints) {
  const rel = fileById.get(print.id);
  const src = rel ? join(source, rel) : "";
  if (!rel || !existsSync(src)) {
    missing.push(print.id);
    continue;
  }
  const targets = [372, 744].map((w) => join(out, String(w), print.imageFile));
  if (targets.every(existsSync)) {
    skipped++;
  } else {
    for (const [i, w] of [372, 744].entries()) {
      await sharp(src).resize({ width: w }).webp({ quality: 82 }).toFile(targets[i]!);
    }
    done++;
  }
  // Avatar só da impressão base da lenda: recorte do terço superior da arte.
  if (legendCards.has(print.id)) {
    const meta = await sharp(src).metadata();
    const w = meta.width ?? 744;
    await sharp(src)
      .extract({ left: Math.round(w * 0.1), top: Math.round(w * 0.12), width: Math.round(w * 0.8), height: Math.round(w * 0.8) })
      .resize(AVATAR, AVATAR)
      .composite([{ input: circle, blend: "dest-in" }])
      .webp({ quality: 85 })
      .toFile(join(out, "avatar", print.imageFile));
  }
}

console.log(`WebP: ${done} gerados, ${skipped} já existiam, ${missing.length} sem arquivo de origem`);
if (missing.length) console.log(`Sem imagem: ${missing.slice(0, 10).join(", ")}${missing.length > 10 ? "…" : ""}`);
console.log(`Saída em ${out}. Para enviar ao Storage do Supabase: pnpm upload:images`);
