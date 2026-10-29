import { MIN_CARD_MATCHES, STAPLE_INCLUSION, type CardUsage, type CardZone, type PoolCard } from "@cr/core";
import { getTranslations } from "next-intl/server";
import { DomainDots } from "@/components/DomainDots";
import { Link } from "@/i18n/navigation";
import { makeFormat } from "@/lib/format";
import { cardImage } from "@/lib/images";
import { CardHover } from "./CardHover";
import { cardName } from "./DeckImages";

const LIMIT: Record<CardZone, number> = { main: 40, battlefields: 12, side: 15 };

/** Cartas mais usadas nas listas de torneio de uma lenda, por zona. */
export async function CardStatsTable({ usage, pool, total, baseWinRate, locale }: { usage: CardUsage[]; pool: Map<string, PoolCard>; total: number; baseWinRate: number | null; locale: string }) {
  const t = await getTranslations("CardStats");
  const f = makeFormat(locale);
  const zones: CardZone[] = ["main", "battlefields", "side"];
  return (
    <div className="mt-4 grid gap-6">
      {zones.map((zone) => {
        const rows = usage.filter((u) => u.zone === zone && pool.has(u.cardId)).slice(0, LIMIT[zone]);
        if (!rows.length) return null;
        return (
          <div key={zone} className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[560px] text-sm">
              <caption className="bg-surface px-3 pt-3 text-left font-display font-semibold">{t(`zones.${zone}`)}</caption>
              <thead className="bg-surface text-left text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">{t("card")}</th>
                  <th className="px-3 py-2 font-medium">{t("inclusion")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("copies")}</th>
                  <th className="px-3 py-2 text-right font-medium" title={t("winRateHint", { min: MIN_CARD_MATCHES })}>{t("winRate")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => {
                  const c = pool.get(u.cardId)!;
                  const n = u.wins + u.losses;
                  const wr = n >= MIN_CARD_MATCHES ? u.wins / n : null;
                  const delta = wr !== null && baseWinRate !== null ? wr - baseWinRate : null;
                  return (
                    <tr key={u.cardId} className="border-t border-border">
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-2">
                          <span className="w-4 text-center text-xs text-muted">{c.energyCost ?? ""}</span>
                          <DomainDots domains={c.domains} />
                          <CardHover src={cardImage(c.id, 744)} lowSrc={cardImage(c.id)} landscape={c.type === "Battlefield"} className="truncate">
                            <Link href={`/cards/${c.code}`} className="hover:text-accent">{cardName(c)}</Link>
                          </CardHover>
                          {zone === "main" && u.inclusion >= STAPLE_INCLUSION && (
                            <span className="rounded bg-accent/15 px-1.5 py-0.5 text-xs text-accent" title={t("stapleHint", { pct: f.pct(STAPLE_INCLUSION, 0) })}>{t("staple")}</span>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-2">
                          <span className="h-1.5 w-24 rounded-full bg-surface-2">
                            <span className="block h-full rounded-full bg-gradient-to-r from-accent to-accent-2" style={{ width: `${u.inclusion * 100}%` }} />
                          </span>
                          <span className="tabular-nums">{f.pct(u.inclusion, 0)}</span>
                          <span className="text-xs text-muted tabular-nums">{t("ofDecks", { count: u.decks, total })}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{f.dec(u.avgCopies, 1)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {wr === null ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <>
                            {f.pct(wr)}
                            {delta !== null && Math.abs(delta) >= 0.005 && (
                              <span className={`ml-1.5 text-xs ${delta > 0 ? "text-good" : "text-bad"}`}>
                                {delta > 0 ? "+" : "−"}
                                {f.dec(Math.abs(delta) * 100, 1)}
                              </span>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
