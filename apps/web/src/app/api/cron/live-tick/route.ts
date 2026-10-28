import { liveTick, UvsClient } from "@cr/ingest";
import { getDb } from "@/lib/db";

// Chamado pelo pg_cron do Supabase a cada 2 min enquanto houver evento ao vivo.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET not set" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "unauthorized" }, { status: 401 });
  const db = getDb();
  if (!db) return Response.json({ error: "DATABASE_URL not set" }, { status: 503 });
  const results = await liveTick(db, new UvsClient());
  return Response.json({ results }, { headers: { "Cache-Control": "no-store" } });
}

export const GET = handle;
export const POST = handle;
