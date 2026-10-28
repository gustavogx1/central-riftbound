import { getLivePulse } from "@/lib/queries";

/**
 * Pulso do ao vivo. Fica 15 s no cache da CDN: com mil pessoas olhando, o
 * banco recebe uma consulta a cada 15 s, não mil.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/events/[id]/pulse">) {
  const { id } = await ctx.params;
  const pulse = Number.isInteger(Number(id)) ? await getLivePulse(Number(id)) : null;
  return Response.json(pulse ?? { live: false, version: 0, changedAt: null }, {
    status: pulse ? 200 : 404,
    headers: { "Cache-Control": "public, max-age=0, s-maxage=15, stale-while-revalidate=15" },
  });
}
