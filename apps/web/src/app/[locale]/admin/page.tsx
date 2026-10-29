import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { decodeDeck, deckToText } from "@cr/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegendAvatar } from "@/components/LegendAvatar";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getSessionUser } from "@/lib/auth/server";
import { poolMap } from "@/lib/decks";
import { makeFormat } from "@/lib/format";
import { getLegendsBySlugs } from "@/lib/queries";
import { reviewAction } from "@/lib/submission-actions";
import { countPending, listSubmissions, REJECT_REASONS, type SubmissionStatus } from "@/lib/submissions";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin" });
  return { title: t("title"), robots: { index: false } };
}

// Depende de quem está logado e muda a cada moderação.
export const dynamic = "force-dynamic";

const STATUSES: SubmissionStatus[] = ["pending", "approved", "rejected"];

/** Moderação das decklists enviadas. Só para quem está em ADMIN_EMAILS; para os outros, a página não existe. */
export default async function AdminPage({ params, searchParams }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getSessionUser();
  if (!user?.admin) notFound();
  const sp = await searchParams;
  const status: SubmissionStatus = STATUSES.includes(sp.status as SubmissionStatus) ? (sp.status as SubmissionStatus) : "pending";
  const t = await getTranslations("Admin");
  const tc = await getTranslations("Common");
  const ts = await getTranslations("Submit");
  const f = makeFormat(locale);
  const [rows, pending, pool] = await Promise.all([listSubmissions(status), countPending(), poolMap()]);
  const legends = await getLegendsBySlugs(rows.flatMap((r) => [r.legend, r.expectedLegend]).filter((s): s is string => Boolean(s)));
  const next = getPathname({ href: { pathname: "/admin", query: { status } }, locale: locale as Locale });
  const error = typeof sp.error === "string" && ["notFound", "duplicate"].includes(sp.error) ? sp.error : null;
  const tab = (active: boolean) => `rounded-md px-3 py-1.5 text-sm ${active ? "bg-surface-2 text-text" : "text-muted hover:text-text"}`;
  const btn = "rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent";
  const text = (code: string) => {
    try {
      return deckToText(decodeDeck(code, pool).deck, pool);
    } catch {
      return code;
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
      <p className="mt-2 max-w-3xl text-muted">{t("lead")}</p>
      <nav className="mt-6 flex flex-wrap gap-2" aria-label={t("title")}>
        {STATUSES.map((s) => (
          <Link key={s} href={{ pathname: "/admin", query: { status: s } }} className={tab(s === status)} aria-current={s === status ? "page" : undefined}>
            {t(`tabs.${s}`)}
            {s === "pending" && pending > 0 && <span className="ml-1.5 rounded-full bg-accent px-1.5 text-xs font-semibold text-accent-ink">{pending}</span>}
          </Link>
        ))}
      </nav>
      {error && <p role="alert" className="mt-4 rounded-md bg-bad/15 px-3 py-2 text-sm text-bad">{t(`errors.${error}` as "errors.duplicate")}</p>}

      {rows.length === 0 ? (
        <p className="mt-6 rounded-xl border border-border bg-surface p-6 text-muted">{t("empty")}</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {rows.map((r) => {
            const l = r.legend ? legends.get(r.legend) : undefined;
            const expected = r.expectedLegend ? legends.get(r.expectedLegend) : undefined;
            return (
              <li key={r.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-start gap-3">
                  {l && <LegendAvatar cardId={l.cardId} champion={l.champion} domains={l.domains} size={40} />}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      <Link href={`/players/${r.playerId}`} className="hover:text-accent">{r.playerName}</Link>
                      <span className="font-normal text-muted"> · {t("rank", { rank: r.rank ?? 0 })} · </span>
                      <Link href={{ pathname: `/events/${r.eventId}`, query: { view: "standings", q: r.playerName } }} className="font-normal hover:text-accent">{r.eventName}</Link>
                    </p>
                    <p className="mt-0.5 text-sm text-muted">
                      {tc("legend")}: {l?.champion ?? "—"} ·{" "}
                      {expected ? t("registered", { legend: expected.champion }) : <span className="text-bad">{t("notRegistered")}</span>}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {t("sentBy", { author: r.author ?? t("deletedUser"), date: f.date(r.createdAt) })}
                      {r.rejectReason && <> · {ts(`reasons.${r.rejectReason}`)}</>}
                    </p>
                    {r.sourceUrl && (
                      <p className="mt-1 truncate text-sm">
                        {t("source")}:{" "}
                        <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-accent underline">{r.sourceUrl}</a>
                      </p>
                    )}
                    {r.note && <p className="mt-1 text-sm whitespace-pre-line">“{r.note}”</p>}
                  </div>
                  <Link href={`/events/${r.eventId}/decks/cr-${r.id}`} className={btn}>{t("preview")}</Link>
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-muted">{t("showList")}</summary>
                  <pre className="mt-2 max-h-80 overflow-auto rounded-md bg-bg p-3 text-xs">{text(r.code)}</pre>
                </details>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {r.status !== "approved" && (
                    <form action={reviewAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="next" value={next} />
                      <input type="hidden" name="decision" value="approve" />
                      <button className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink">{t("approve")}</button>
                    </form>
                  )}
                  {r.status !== "rejected" && (
                    <form action={reviewAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="next" value={next} />
                      <input type="hidden" name="decision" value="reject" />
                      <label className="text-sm">
                        <span className="sr-only">{t("reason")}</span>
                        <select name="reason" defaultValue="wrongList" className="rounded-md border border-border bg-bg px-2 py-1.5">
                          {REJECT_REASONS.map((x) => (
                            <option key={x} value={x}>{ts(`reasons.${x}`)}</option>
                          ))}
                        </select>
                      </label>
                      <button className={`${btn} text-bad`}>{r.status === "approved" ? t("unpublish") : t("reject")}</button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
