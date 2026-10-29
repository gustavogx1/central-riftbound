import { getEventPlayerMatches, getLegendsBySlugs, getPlayer } from "@/lib/queries";

/** Partidas de um jogador no evento (até a rodada `?round=`), para abrir na classificação. */
export async function GET(req: Request, ctx: RouteContext<"/api/events/[id]/players/[pid]/matches">) {
  const { id, pid } = await ctx.params;
  const eventId = Number(id);
  const playerId = Number(pid);
  const round = Number(new URL(req.url).searchParams.get("round")) || undefined;
  if (!Number.isInteger(eventId) || !Number.isInteger(playerId)) return Response.json({ rows: [], legends: {} }, { status: 404 });
  // Jogador oculto não tem histórico público.
  const player = await getPlayer(playerId);
  if (!player) return Response.json({ rows: [], legends: {} }, { status: 404 });
  const rows = await getEventPlayerMatches(eventId, playerId, round);
  const legends = await getLegendsBySlugs([...new Set(rows.flatMap((r) => (r.opponentLegend ? [r.opponentLegend] : [])))]);
  return Response.json(
    { rows, legends: Object.fromEntries([...legends].map(([k, l]) => [k, { champion: l.champion, title: l.title, cardId: l.cardId, domains: l.domains }])) },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" } },
  );
}
