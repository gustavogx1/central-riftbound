"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { LegendAvatar } from "@/components/LegendAvatar";
import { Link } from "@/i18n/navigation";
import type { EventPlayerMatch } from "@/lib/queries";

type LegendLite = { champion: string; title: string; cardId: string; domains: string[] };
type Data = { rows: EventPlayerMatch[]; legends: Record<string, LegendLite> };

/**
 * Linha da classificação que abre as partidas do jogador no evento.
 * Busca só no primeiro clique; clicar num link da linha não abre.
 */
export function StandingRow({
  eventId, playerId, playerName, roundId, roundNumber, multiPhase, cols, expandable, children,
}: {
  eventId: number; playerId: number; playerName: string; roundId: number | undefined; roundNumber: number | undefined;
  multiPhase: boolean; cols: number; expandable: boolean; children: ReactNode;
}) {
  const t = useTranslations("Event");
  const tp = useTranslations("Player");
  const tc = useTranslations("Common");
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const panelId = `matches-${playerId}`;

  const toggle = () => {
    if (!expandable) return;
    const next = !open;
    setOpen(next);
    if (next && !data) {
      setFailed(false);
      fetch(`/api/events/${eventId}/players/${playerId}/matches${roundId ? `?round=${roundId}` : ""}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((d: Data) => setData(d))
        .catch(() => setFailed(true));
    }
  };
  const onClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest("a, button")) return;
    toggle();
  };

  return (
    <>
      <tr
        className={`border-t border-border ${expandable ? "cursor-pointer hover:bg-surface" : ""} ${open ? "bg-surface" : ""}`}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            toggle();
          }
        }}
        tabIndex={expandable ? 0 : undefined}
        aria-expanded={expandable ? open : undefined}
        aria-controls={expandable ? panelId : undefined}
      >
        {children}
      </tr>
      {open && (
        <tr id={panelId} className="bg-bg">
          <td colSpan={cols} className="px-3 pb-4 pt-2">
            <p className="mb-2 text-xs text-muted">
              {roundNumber ? t("matchesThrough", { player: playerName, round: roundNumber }) : t("matchesOf", { player: playerName })}
            </p>
            {failed ? (
              <p className="text-sm text-bad">{t("matchesError")}</p>
            ) : !data ? (
              <p className="text-sm text-muted">{t("loadingMatches")}</p>
            ) : data.rows.length === 0 ? (
              <p className="text-sm text-muted">{t("noMatches")}</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-surface text-left text-muted">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t("round")}</th>
                      <th className="px-3 py-2 font-medium">{t("table")}</th>
                      <th className="px-3 py-2 font-medium">{tp("opponent")}</th>
                      <th className="px-3 py-2 font-medium">{tp("opponentLegend")}</th>
                      <th className="px-3 py-2 font-medium">{tp("result")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("score")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((m) => {
                      const l = m.opponentLegend ? data.legends[m.opponentLegend] : undefined;
                      const tone = m.result === "win" ? "text-good" : m.result === "loss" ? "text-bad" : "text-muted";
                      return (
                        <tr key={m.id} className="border-t border-border">
                          <td className="px-3 py-2 tabular-nums">{multiPhase ? `${m.phaseName} · ${m.roundNumber}` : m.roundNumber}</td>
                          <td className="px-3 py-2 tabular-nums text-muted">{m.table ?? "—"}</td>
                          <td className="px-3 py-2">
                            {m.isBye ? (
                              <span className="text-muted">{tp("bye")}</span>
                            ) : m.opponentId && !m.opponentHidden && m.opponent ? (
                              <Link href={`/players/${m.opponentId}`} className="hover:text-accent">{m.opponent}</Link>
                            ) : (
                              tc("hiddenPlayer")
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {m.isBye ? null : l ? (
                              <Link href={`/legends/${m.opponentLegend}`} className="flex items-center gap-2 hover:text-accent">
                                <LegendAvatar cardId={l.cardId} champion={l.champion} domains={l.domains} size={24} />
                                <span className="truncate">{l.champion} <span className="text-muted">— {l.title}</span></span>
                              </Link>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td className={`px-3 py-2 font-semibold ${tone}`}>{m.result ? tp(m.result) : tp("playing")}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{m.games ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
