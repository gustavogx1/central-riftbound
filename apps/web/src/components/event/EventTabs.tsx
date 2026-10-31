import { getTranslations } from "next-intl/server";
import { LegendAvatar } from "@/components/LegendAvatar";
import { Pagination } from "@/components/Pagination";
import { Link } from "@/i18n/navigation";
import type { makeFormat } from "@/lib/format";
import type { EventPlayerRow, LegendInfo } from "@/lib/queries";
import { FollowButton } from "./FollowButton";
import { LegendCell } from "./LegendCell";

type Fmt = ReturnType<typeof makeFormat>;
const record = (r: { wins: number; losses: number; draws: number }) => `${r.wins}-${r.losses}-${r.draws}`;

/** Aba "Jogadores": todos os inscritos em ordem alfabética, com busca e o coração de seguir. */
export async function PlayersTab({
  eventId, rows, legends, followed, q, page, pageSize,
}: { eventId: number; rows: EventPlayerRow[]; legends: Map<string, LegendInfo>; followed: Set<number>; q?: string; page: number; pageSize: number }) {
  const t = await getTranslations("Event");
  const tc = await getTranslations("Common");
  const total = rows[0]?.total ?? 0;
  return (
    <>
      <form className="mt-4 flex flex-wrap items-center gap-3" method="get">
        <input type="hidden" name="view" value="players" />
        <label className="flex flex-1 items-center gap-2 text-sm">
          <span className="sr-only">{tc("searchPlayer")}</span>
          <input name="q" defaultValue={q} placeholder={tc("searchPlayer")} className="w-full max-w-xs rounded-md border border-border bg-surface px-3 py-1.5" />
        </label>
        <button className="rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-accent-ink">{tc("search")}</button>
      </form>
      <p className="mt-3 text-sm text-muted">{t("playersHint", { n: total })}</p>
      {rows.length === 0 ? (
        <p className="mt-6 text-muted">{t("noPlayersFound")}</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-surface text-left text-muted">
              <tr>
                <th className="w-10 px-2 py-2"><span className="sr-only">{t("followCol")}</span></th>
                <th className="px-3 py-2 font-medium">{tc("player")}</th>
                <th className="px-3 py-2 font-medium">{tc("legend")}</th>
                <th className="px-3 py-2 text-right font-medium">{tc("record")}</th>
                <th className="px-3 py-2 text-right font-medium">{tc("rank")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.playerId} className="border-t border-border">
                  <td className="px-2 py-1.5"><FollowButton playerId={r.playerId} name={r.name} followed={followed.has(r.playerId)} /></td>
                  <td className="px-3 py-2 font-medium"><Link href={`/players/${r.playerId}`} className="hover:text-accent">{r.name}</Link></td>
                  <td className="px-3 py-2"><LegendCell slug={r.legend} legends={legends} /></td>
                  <td className="px-3 py-2 text-right tabular-nums">{record(r)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted">{r.rank ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination pathname={`/events/${eventId}`} query={{ view: "players", q }} page={page} total={total} pageSize={pageSize} />
    </>
  );
}

/** Aba "Seguindo": os jogadores seguidos, com campanha, posição e a mesa da rodada atual. */
export async function FollowingTab({
  eventId, rows, legends, followCount, roundLabels,
}: { eventId: number; rows: EventPlayerRow[]; legends: Map<string, LegendInfo>; followCount: number; roundLabels: Record<number, string> }) {
  const t = await getTranslations("Event");
  if (rows.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-border px-6 py-10 text-center">
        <p className="font-display text-lg font-semibold">{followCount > 0 ? t("followingNoneHere") : t("followingEmpty")}</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">{t("followingHint")}</p>
        <Link href={{ pathname: `/events/${eventId}`, query: { view: "players" } }} className="mt-4 inline-block rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-accent-ink">
          {t("addPlayers")}
        </Link>
      </div>
    );
  }
  return (
    <>
      <p className="mt-4 text-sm text-muted">{t("followingLead")}</p>
      <ul className="mt-3 grid gap-3 md:grid-cols-2">
        {rows.map((r) => {
          const opp = r.opponentLegend ? legends.get(r.opponentLegend) : undefined;
          const res = r.result === "win" ? t("resWin") : r.result === "loss" ? t("resLoss") : r.result === "draw" ? t("draw") : null;
          return (
            <li key={r.playerId} className="rounded-xl border border-border bg-surface p-3">
              <div className="flex items-center gap-3">
                <FollowButton playerId={r.playerId} name={r.name} followed refresh />
                <div className="min-w-0 flex-1">
                  <Link href={`/players/${r.playerId}`} className="block truncate font-semibold hover:text-accent">{r.name}</Link>
                  <span className="mt-0.5 block text-xs"><LegendCell slug={r.legend} legends={legends} size={20} /></span>
                </div>
                <div className="text-right">
                  <span className="block font-display text-lg font-bold tabular-nums">{record(r)}</span>
                  <span className="block text-xs text-muted">{r.rank ? t("rankN", { n: r.rank }) : "—"}</span>
                </div>
              </div>
              {r.roundId !== null && (r.opponentId || r.isBye) && (
                <div className="mt-3 flex items-center gap-2 border-t border-border pt-2 text-sm">
                  <span className="shrink-0 text-xs text-muted">{roundLabels[r.roundId] ?? ""}{r.table ? ` · ${t("table")} ${r.table}` : ""}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {r.isBye ? t("bye") : (
                      <span className="inline-flex items-center gap-1.5">
                        {t("vs")}
                        {opp && <LegendAvatar cardId={opp.cardId} champion={opp.champion} domains={opp.domains} size={18} />}
                        {r.opponentId && r.opponent ? <Link href={`/players/${r.opponentId}`} className="truncate hover:text-accent">{r.opponent}</Link> : "—"}
                      </span>
                    )}
                  </span>
                  <span className={`shrink-0 text-xs font-semibold ${r.result === "win" ? "text-good" : r.result === "loss" ? "text-bad" : "text-muted"}`}>
                    {res ?? t("inProgress")}
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** Aba "Meta": lendas do evento à esquerda; à direita, como os jogadores da lenda escolhida estão na classificação. */
export async function MetaTab({
  eventId, metaRows, legends, selected, standings, f, unofficial,
}: {
  eventId: number;
  metaRows: { legend: string; players: number; bestRank: number }[];
  legends: Map<string, LegendInfo>;
  selected: string | null;
  standings: { s: { playerId: number; rank: number; wins: number; losses: number; draws: number; points: number; omw: number | null }; name: string; hidden: boolean }[];
  f: Fmt;
  unofficial: boolean;
}) {
  const t = await getTranslations("Event");
  const tc = await getTranslations("Common");
  if (metaRows.length === 0) return <p className="mt-6 text-muted">{t("noMeta")}</p>;
  const total = metaRows.reduce((a, m) => a + m.players, 0);
  const max = metaRows[0]?.players ?? 1;
  const sel = selected ? legends.get(selected) : undefined;
  const selRow = metaRows.find((m) => m.legend === selected);
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[300px_1fr]">
      <ul className="max-h-72 overflow-y-auto rounded-xl border border-border lg:sticky lg:top-4 lg:max-h-[70vh]" aria-label={t("meta")}>
        {metaRows.map((m) => {
          const l = legends.get(m.legend);
          const active = m.legend === selected;
          return (
            <li key={m.legend} className="border-b border-border last:border-b-0">
              <Link
                href={{ pathname: `/events/${eventId}`, query: { view: "meta", legend: m.legend } }}
                scroll={false}
                aria-current={active ? "true" : undefined}
                className={`flex items-center gap-3 px-3 py-2 text-sm transition ${active ? "bg-surface-2" : "bg-surface hover:bg-surface-2"}`}
              >
                {l ? <LegendAvatar cardId={l.cardId} champion={l.champion} domains={l.domains} size={32} /> : <span className="h-8 w-8" />}
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-medium">{l?.champion ?? m.legend}</span>
                    <span className="tabular-nums text-xs font-semibold">{f.pct(m.players / total)}</span>
                  </span>
                  <span className="mt-1 block h-1 rounded bg-surface-2">
                    <span className={`block h-1 rounded ${active ? "bg-accent" : "bg-muted/60"}`} style={{ width: `${Math.max(4, (m.players / max) * 100)}%` }} />
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">{t("nPlayers", { n: m.players })}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="min-w-0">
        {sel && selRow && (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
            <LegendAvatar cardId={sel.cardId} champion={sel.champion} domains={sel.domains} size={44} />
            <div className="min-w-0 flex-1">
              <Link href={`/legends/${sel.slug}`} className="block truncate font-display text-lg font-semibold hover:text-accent">{sel.champion}, {sel.title}</Link>
              <span className="text-sm text-muted">{t("nPlayers", { n: selRow.players })} · {t("bestFinish", { n: selRow.bestRank })}</span>
            </div>
            <div className="text-right">
              <span className="block font-display text-2xl font-bold tabular-nums">{f.pct(selRow.players / total)}</span>
              <span className="text-xs text-muted">{t("ofField")}</span>
            </div>
          </div>
        )}
        {unofficial && <p className="mt-3 text-sm text-muted">{t("metaProvisional")}</p>}
        <div className="mt-3 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-surface text-left text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">{tc("rank")}</th>
                <th className="px-3 py-2 font-medium">{tc("player")}</th>
                <th className="px-3 py-2 text-right font-medium">{tc("record")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("points")}</th>
                <th className="px-3 py-2 text-right font-medium" title={t("omwHint")}>{t("omw")}</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((r) => (
                <tr key={r.s.playerId} className="border-t border-border">
                  <td className="px-3 py-2 tabular-nums text-muted">{r.s.rank}</td>
                  <td className="px-3 py-2 font-medium">
                    {r.hidden ? tc("hiddenPlayer") : <Link href={`/players/${r.s.playerId}`} className="hover:text-accent">{r.name}</Link>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.s.wins}-{r.s.losses}-{r.s.draws}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.s.points}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{f.pct(r.s.omw)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
