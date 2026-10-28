/**
 * Envia as WebP de data/images/ para o Storage do Supabase (bucket público).
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… pnpm upload:images
 * Pula o que já está lá com o mesmo tamanho. Endereço público resultante:
 *   <SUPABASE_URL>/storage/v1/object/public/cards  →  NEXT_PUBLIC_IMAGE_BASE_URL
 */
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_BUCKET ?? "cards";
if (!url || !key) {
  console.log("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
// Chave nova (sb_secret_…) vai só no apikey; a antiga service_role (JWT) vai também como Bearer.
const headers: Record<string, string> = key.startsWith("sb_") ? { apikey: key } : { Authorization: `Bearer ${key}`, apikey: key };
const root = resolve("data/images");

// O Storage às vezes devolve 5xx (520 do Cloudflare) ou cai a conexão no meio de milhares de envios: tenta de novo com espera crescente.
async function call(input: string, init: RequestInit, tries = 5): Promise<Response> {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(input, init);
      if (res.status < 500 || i === tries) return res;
      console.log(`  ${res.status} em ${input.split("/storage/v1/")[1]}, tentativa ${i}/${tries}`);
    } catch (err) {
      if (i === tries) throw err;
      console.log(`  falha de conexão, tentativa ${i}/${tries}`);
    }
    await new Promise((r) => setTimeout(r, 2000 * 2 ** (i - 1)));
  }
}

// Bucket público (só leitura para visitantes; escrita só com a chave de serviço).
const created = await call(`${url}/storage/v1/bucket`, {
  method: "POST",
  headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify({ id: bucket, name: bucket, public: true, allowed_mime_types: ["image/webp"] }),
});
if (!created.ok && created.status !== 409 && !(await created.text()).includes("already exists")) {
  throw new Error(`Não consegui criar o bucket: ${created.status}`);
}

async function existing(folder: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (let offset = 0; ; offset += 1000) {
    const res = await call(`${url}/storage/v1/object/list/${bucket}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: folder, limit: 1000, offset }),
    });
    if (!res.ok) throw new Error(`Não consegui listar ${folder}: ${res.status}`);
    const rows = (await res.json()) as { name: string; metadata?: { size?: number } }[];
    for (const r of rows) out.set(r.name, r.metadata?.size ?? -1);
    if (rows.length < 1000) return out;
  }
}

let sent = 0;
let kept = 0;
for (const folder of ["372", "744", "avatar"]) {
  const remote = await existing(folder);
  const files = (await readdir(join(root, folder))).filter((f) => f.endsWith(".webp"));
  for (const file of files) {
    const body = await readFile(join(root, folder, file));
    if (remote.get(file) === body.length) {
      kept++;
      continue;
    }
    const res = await call(`${url}/storage/v1/object/${bucket}/${folder}/${file}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "image/webp", "x-upsert": "true", "Cache-Control": "max-age=31536000" },
      body,
    });
    if (!res.ok) throw new Error(`${folder}/${file}: ${res.status} ${await res.text()}`);
    if (++sent % 200 === 0) console.log(`  ${sent} enviados…`);
  }
}
console.log(`Imagens: ${sent} enviadas, ${kept} já estavam lá.`);
console.log(`NEXT_PUBLIC_IMAGE_BASE_URL=${url}/storage/v1/object/public/${bucket}`);
