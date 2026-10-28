import { useLocale, useTranslations } from "next-intl";
import { LegendAvatar } from "@/components/LegendAvatar";
import { Link } from "@/i18n/navigation";
import { makeFormat } from "@/lib/format";
import type { LegendInfo, PlayerMatch } from "@/lib/queries";

function LegendName({ slug, legends }: { slug: string | null; legends: Map<string, LegendInfo> }) {
  const l = slug ? legends.get(slug) : undefined;
  if (!l) return <span className="text-muted">—</span>;
  return (
    <span className="flex items-center gap-1.5">
      <LegendAvatar cardId={l.cardId} champion={l.champion} domains={l.domains} size={20} />
      <span className="truncate">{l.champion}</span>
    </span>
  );
}

/** Lista de partidas do ponto de vista de um jogador. */
export function PlayerMatches({ rows, legends, showOpponent = true }: { rows: PlayerMatch[]; legends: Map<string, LegendInfo>; showOpponent?: boolean }) {
  const t = useTranslations("Player");
  const tc = useTranslations("Common");
  const f = makeFormat(useLocale());
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[680px] text-sm">
        <thead className="bg-surface text-left text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">{t("event")}</th>
            <th className="px-3 py-2 font-medium">{tc("legend")}</th>
            {showOpponent && <th className="px-3 py-2 font-medium">{t("opponent")}</th>}
            <th className="px-3 py-2 font-medium">{t("opponentLegend")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("result")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id} className="border-t border-border">
              <td className="px-3 py-2">
                <Link href={`/events/${m.eventId}`} className="block max-w-[16rem] truncate hover:text-accent">{m.eventName}</Link>
                <span className="text-xs text-muted">{f.date(m.startsAt)} · {m.phaseName} {m.roundNumber}</span>
              </td>
              <td className="px-3 py-2"><LegendName slug={m.legend} legends={legends} /></td>
              {showOpponent && (
                <td className="px-3 py-2">
                  {m.isBye ? (
                    <span className="text-muted">{t("bye")}</span>
                  ) : m.opponentId && !m.opponentHidden ? (
                    <Link href={`/players/${m.opponentId}`} className="hover:text-accent">{m.opponent}</Link>
                  ) : (
                    tc("hiddenPlayer")
                  )}
                </td>
              )}
              <td className="px-3 py-2">{m.isBye ? "" : <LegendName slug={m.opponentLegend} legends={legends} />}</td>
              <td className={`px-3 py-2 text-right font-semibold tabular-nums ${m.result === "win" ? "text-good" : m.result === "loss" ? "text-bad" : ""}`}>
                {m.result ? t(m.result) : t("playing")}
                {m.games && <span className="ml-1 font-normal text-muted">{m.games}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function recordOf(rows: { wins: number; losses: number; draws: number }[]) {
  return rows.reduce((a, r) => ({ wins: a.wins + r.wins, losses: a.losses + r.losses, draws: a.draws + r.draws }), { wins: 0, losses: 0, draws: 0 });
}
