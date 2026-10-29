import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegendAvatar } from "@/components/LegendAvatar";
import { SubmitDeckForm } from "@/components/deck/SubmitDeckForm";
import { Link, redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getSessionUser } from "@/lib/auth/server";
import { listMyDecks } from "@/lib/decks";
import { makeFormat } from "@/lib/format";
import { getEvent, getLegendsBySlugs } from "@/lib/queries";
import { getEntrant, hasPublishedDeck, MAX_LIST, MAX_NOTE, MAX_URL, searchEntrants } from "@/lib/submissions";

export async function generateMetadata({ params }: PageProps<"/[locale]/events/[id]/submit">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Submit" });
  return { title: t("title"), robots: { index: false } };
}

/** Envio de decklist: escolher o jogador na classificação e colar a lista. */
export default async function SubmitDeckPage({ params, searchParams }: PageProps<"/[locale]/events/[id]/submit">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const ev = Number.isInteger(Number(id)) ? await getEvent(Number(id)) : null;
  if (!ev) notFound();
  const sp = await searchParams;
  const user = await getSessionUser();
  const here = `/events/${ev.id}/submit${typeof sp.player === "string" ? `?player=${encodeURIComponent(sp.player)}` : ""}`;
  if (!user) redirect({ href: { pathname: "/login", query: { next: here } }, locale: locale as Locale });
  const t = await getTranslations("Submit");
  const tc = await getTranslations("Common");
  const f = makeFormat(locale);
  const q = typeof sp.q === "string" && sp.q.trim() ? sp.q.trim().slice(0, 60) : undefined;
  const playerId = Number(sp.player) || null;
  const complete = ev.status === "complete";

  const [entrant, entrants, myDecks] = await Promise.all([
    complete && playerId ? getEntrant(ev.id, playerId) : Promise.resolve(null),
    complete && !playerId ? searchEntrants(ev.id, q) : Promise.resolve([]),
    complete && playerId ? listMyDecks(user!.id) : Promise.resolve([]),
  ]);
  const published = entrant ? await hasPublishedDeck(ev.id, entrant.playerId) : false;
  const slugs = [entrant?.legend, ...entrants.map((e) => e.legend)].filter((s): s is string => Boolean(s));
  const legends = await getLegendsBySlugs(slugs);
  const legendOf = (slug: string | null) => (slug ? legends.get(slug) : undefined);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-sm text-muted">
        <Link href={{ pathname: `/events/${ev.id}`, query: { view: "decks" } }} className="hover:text-text">{ev.name}</Link> / {f.date(ev.startsAt)}
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold">{t("title")}</h1>
      <p className="mt-2 text-muted">{t("lead")}</p>

      {!complete ? (
        <p className="mt-8 rounded-xl border border-border bg-surface p-6 text-muted">{t("notComplete")}</p>
      ) : !playerId ? (
        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold">{t("step1")}</h2>
          <form className="mt-3 flex flex-wrap gap-2" method="get">
            <label className="min-w-0 flex-1">
              <span className="sr-only">{tc("searchPlayer")}</span>
              <input name="q" defaultValue={q} placeholder={tc("searchPlayer")} className="w-full rounded-md border border-border bg-surface px-3 py-2" />
            </label>
            <button className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">{tc("search")}</button>
          </form>
          {entrants.length === 0 ? (
            <p className="mt-4 text-sm text-muted">{t("noEntrants")}</p>
          ) : (
            <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border">
              {entrants.map((e) => {
                const l = legendOf(e.legend);
                return (
                  <li key={e.playerId}>
                    <Link href={{ pathname: `/events/${ev.id}/submit`, query: { player: e.playerId } }} className="flex items-center gap-3 bg-surface px-3 py-2.5 text-sm hover:bg-surface-2">
                      <span className="w-10 tabular-nums text-muted">{t("rankShort", { rank: e.rank })}</span>
                      <span className="min-w-0 flex-1 truncate font-medium">{e.name}</span>
                      {l && (
                        <span className="flex items-center gap-2 text-muted">
                          <LegendAvatar cardId={l.cardId} champion={l.champion} domains={l.domains} size={22} />
                          <span className="hidden sm:inline">{l.champion}</span>
                        </span>
                      )}
                      <span className="text-accent">{t("pick")}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted">{t("hiddenNote")}</p>
        </section>
      ) : !entrant ? (
        <p className="mt-8 rounded-xl border border-border bg-surface p-6 text-muted">
          {t("notEntrant")}{" "}
          <Link href={`/events/${ev.id}/submit`} className="text-accent underline">{t("changePlayer")}</Link>
        </p>
      ) : (
        <section className="mt-8 space-y-6">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4">
            {legendOf(entrant.legend) && (
              <LegendAvatar cardId={legendOf(entrant.legend)!.cardId} champion={legendOf(entrant.legend)!.champion} domains={legendOf(entrant.legend)!.domains} size={44} />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-semibold">{entrant.name}</p>
              <p className="text-sm text-muted">
                {t("entrantLine", { rank: entrant.rank, players: ev.playerCount, legend: legendOf(entrant.legend)?.champion ?? "—" })}
              </p>
            </div>
            <Link href={`/events/${ev.id}/submit`} className="text-sm text-accent underline">{t("changePlayer")}</Link>
          </div>
          {published ? (
            <p className="rounded-xl border border-border bg-surface p-6 text-muted">
              {t("alreadyPublished")}{" "}
              <Link href={{ pathname: `/events/${ev.id}`, query: { view: "decks", q: entrant.name } }} className="text-accent underline">{t("seeDecks")}</Link>
            </p>
          ) : (
            <SubmitDeckForm
              eventId={ev.id}
              playerId={entrant.playerId}
              admin={user!.admin}
              myDecks={myDecks.map((d) => ({ id: d.id, name: d.name, code: d.code }))}
              limits={{ list: MAX_LIST, note: MAX_NOTE, url: MAX_URL }}
            />
          )}
        </section>
      )}
    </div>
  );
}
