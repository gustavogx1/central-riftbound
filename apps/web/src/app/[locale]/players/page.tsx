import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TrophyIcon } from "@/components/Honors";
import { Pagination } from "@/components/Pagination";
import { Link } from "@/i18n/navigation";
import { makeFormat } from "@/lib/format";
import { searchPlayers } from "@/lib/queries";
import { getRanking, parsePeriod, RANKING_PERIODS } from "@/lib/ranking";

const PAGE_SIZE = 50;

/** Bandeira em emoji a partir do código ISO de duas letras. */
const flag = (code: string) => (/^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0))) : "");

export async function generateMetadata({ params }: PageProps<"/[locale]/players">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Players" });
  return { title: t("title"), description: t("lead") };
}

export default async function PlayersPage({ params, searchParams }: PageProps<"/[locale]/players">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Players");
  const tc = await getTranslations("Common");
  const ts = await getTranslations("Sets");
  const f = makeFormat(locale);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 60) : "";
  // Com ?vs=<id>, a busca serve para escolher o adversário do head-to-head.
  const vs = Number(sp.vs) || null;
  const rows = q.length >= 2 ? await searchPlayers(q) : [];
  const showRanking = q.length < 2 && !vs;
  const period = parsePeriod(sp.period);
  const country = typeof sp.country === "string" && /^[A-Z]{2}$/.test(sp.country) ? sp.country : "";
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const ranking = showRanking ? await getRanking(period, country || undefined) : null;
  const regionName = new Intl.DisplayNames([locale], { type: "region" });
  const countryName = (code: string) => {
    try {
      return regionName.of(code) ?? code;
    } catch {
      return code;
    }
  };
  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm transition ${active ? "border-accent bg-surface-2 text-text" : "border-border text-muted hover:bg-surface hover:text-text"}`;
  const periodLabel = (p: string) => (p === "12m" ? t("last12m") : p === "all" ? t("allTime") : ts(p as "OGN"));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold md:text-4xl">{vs ? t("pickOpponent") : t("title")}</h1>
      <p className="mt-3 text-muted">{t("lead")}</p>
      <form className="mt-6 flex gap-3" method="get">
        {vs && <input type="hidden" name="vs" value={vs} />}
        <label className="flex-1">
          <span className="sr-only">{tc("searchPlayer")}</span>
          <input name="q" defaultValue={q} placeholder={tc("searchPlayer")} minLength={2} className="w-full rounded-md border border-border bg-surface px-3 py-2" />
        </label>
        <button className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">{tc("search")}</button>
      </form>
      {q.length >= 2 && (
        rows.length === 0 ? (
          <p className="mt-6 text-muted">{t("none")}</p>
        ) : (
          <ul className="mt-6 divide-y divide-border overflow-hidden rounded-xl border border-border">
            {rows.map((p) => (
              <li key={p.id}>
                <Link
                  href={vs && vs !== p.id ? `/players/${vs}/vs/${p.id}` : `/players/${p.id}`}
                  className="flex items-center justify-between gap-3 bg-surface px-4 py-3 hover:bg-surface-2"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{p.name}</span>
                    {p.name !== p.realName && <span className="ml-2 text-sm text-muted">{p.realName}</span>}
                  </span>
                  <span className="text-sm text-muted">{t("eventsCount", { n: f.num(p.events) })}</span>
                </Link>
              </li>
            ))}
          </ul>
        )
      )}
      {ranking && (
        <section className="mt-12" aria-labelledby="ranking">
          <h2 id="ranking" className="font-display text-2xl font-bold">{t("ranking")}</h2>
          <p className="mt-2 text-sm text-muted">
            {t("rankingLead")}{" "}
            <Link href="/about/methodology" className="underline decoration-dotted underline-offset-4 hover:text-text">{t("rankingHow")}</Link>
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label={t("period")}>
            {RANKING_PERIODS.map((p) => (
              <Link key={p} href={{ pathname: "/players", query: country ? { period: p, country } : { period: p } }} className={pill(p === period)} aria-current={p === period ? "true" : undefined}>
                {periodLabel(p)}
              </Link>
            ))}
          </div>
          {ranking.countries.length > 0 && (
            <form className="mt-3 flex items-center gap-2 text-sm" method="get">
              <input type="hidden" name="period" value={period} />
              <label htmlFor="country" className="text-muted">{t("country")}</label>
              <select id="country" name="country" defaultValue={country} className="rounded-md border border-border bg-surface px-2 py-1.5">
                <option value="">{t("allCountries")}</option>
                {ranking.countries.map((c) => (
                  <option key={c.code} value={c.code}>{`${flag(c.code)} ${countryName(c.code)} (${f.num(c.players)})`}</option>
                ))}
              </select>
              <button className="rounded-md border border-border px-3 py-1.5 hover:bg-surface">{t("apply")}</button>
            </form>
          )}
          {ranking.rows.length === 0 ? (
            <p className="mt-6 rounded-xl border border-border bg-surface p-6 text-muted">{t("rankingEmpty")}</p>
          ) : (
            <>
              <p className="mt-4 text-xs text-muted">{t("rankingBasedOn", { players: f.num(ranking.rows.length), events: f.num(ranking.events) })}</p>
              <div className="mt-2 overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-surface text-left text-xs text-muted">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-right">#</th>
                      <th scope="col" className="px-3 py-2">{tc("player")}</th>
                      <th scope="col" className="px-3 py-2 text-right">{t("points")}</th>
                      <th scope="col" className="hidden px-3 py-2 text-right sm:table-cell">{t("scoringEvents")}</th>
                      <th scope="col" className="px-3 py-2 text-right">{t("titles")}</th>
                      <th scope="col" className="hidden px-3 py-2 text-right sm:table-cell">{t("bestFinish")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {ranking.rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((r) => (
                      <tr key={r.playerId} className="hover:bg-surface">
                        <td className="px-3 py-2 text-right tabular-nums text-muted">{r.position}</td>
                        <td className="px-3 py-2">
                          <Link href={`/players/${r.playerId}`} className="font-medium hover:underline">
                            {r.country && <span className="mr-1.5" title={countryName(r.country)}>{flag(r.country)}</span>}
                            {r.name}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{f.num(r.points)}</td>
                        <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">{f.num(r.events)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {r.wins > 0 ? (
                            <span className="inline-flex items-center gap-1">
                              <TrophyIcon size={14} />
                              {r.wins}
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">{t("place", { rank: r.bestRank })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                pathname="/players"
                query={{ period, country: country || undefined }}
                page={page}
                total={ranking.rows.length}
                pageSize={PAGE_SIZE}
              />
            </>
          )}
        </section>
      )}
      <p className="mt-8 text-xs text-muted">{t("privacy")}</p>
    </div>
  );
}
