import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DeckCardItem } from "@/components/DeckCardItem";
import { getPathname, Link, redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { signOut } from "@/lib/auth/actions";
import { getSessionUser } from "@/lib/auth/server";
import { renameAction } from "@/lib/deck-actions";
import { listMyDecks, MAX_DECKS_PER_USER } from "@/lib/decks";
import { makeFormat } from "@/lib/format";
import { getLegends } from "@/lib/queries";
import { deleteSubmissionAction } from "@/lib/submission-actions";
import { countPending, listMySubmissions } from "@/lib/submissions";

export async function generateMetadata({ params }: PageProps<"/[locale]/account">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Account" });
  return { title: t("myAccount"), robots: { index: false } };
}

export default async function AccountPage({ params }: PageProps<"/[locale]/account">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getSessionUser();
  if (!user) redirect({ href: { pathname: "/login", query: { next: "/account" } }, locale: locale as Locale });
  const t = await getTranslations("Account");
  const ts = await getTranslations("Submit");
  const f = makeFormat(locale);
  const [decks, legends, submissions, pending] = await Promise.all([listMyDecks(user!.id), getLegends(), listMySubmissions(user!.id), user!.admin ? countPending() : Promise.resolve(0)]);
  const byCard = new Map(legends.map((l) => [l.cardId, l]));
  const bySlug = new Map(legends.map((l) => [l.slug, l]));
  const here = getPathname({ href: "/account", locale: locale as Locale });
  const home = getPathname({ href: "/", locale: locale as Locale });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-bold">{t("myAccount")}</h1>
        <form action={signOut}>
          <input type="hidden" name="next" value={home} />
          <button className="rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent">{t("signOut")}</button>
        </form>
      </div>

      {user!.admin && (
        <p className="mt-4 text-sm">
          <Link href="/admin" className="text-accent underline">{t("moderation", { count: pending })}</Link>
        </p>
      )}

      <form action={renameAction} className="mt-6 flex flex-wrap items-end gap-2 rounded-xl border border-border bg-surface p-4">
        <input type="hidden" name="next" value={here} />
        <label className="min-w-0 flex-1 text-sm">
          <span className="text-muted">{t("displayName")}</span>
          <input name="name" defaultValue={user!.name} maxLength={40} required className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2" />
        </label>
        <button className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">{t("save")}</button>
        <p className="w-full text-xs text-muted">{t("displayNameHelp")}</p>
      </form>

      <div className="mt-10 flex flex-wrap items-end justify-between gap-2">
        <h2 className="font-display text-2xl font-semibold">{t("myDecks")}</h2>
        <span className="text-sm text-muted">{t("deckLimit", { count: decks.length, max: MAX_DECKS_PER_USER })}</span>
      </div>
      {decks.length === 0 ? (
        <p className="mt-4 rounded-xl border border-border bg-surface p-6 text-muted">
          {t.rich("noDecks", { link: (c) => <Link href="/builder" className="text-accent underline">{c}</Link> })}
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {decks.map((d) => (
            <li key={d.id}>
              <DeckCardItem deck={d} legend={d.legendCardId ? byCard.get(d.legendCardId) : undefined} locale={locale} showVisibility />
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-10 font-display text-2xl font-semibold">{ts("mySubmissions")}</h2>
      {submissions.length === 0 ? (
        <p className="mt-4 rounded-xl border border-border bg-surface p-6 text-muted">
          {t.rich("noSubmissions", { link: (c) => <Link href="/events" className="text-accent underline">{c}</Link> })}
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {submissions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-3 text-sm">
              <div className="min-w-0 flex-1">
                <Link href={`/events/${s.eventId}/decks/cr-${s.id}`} className="font-semibold hover:text-accent">
                  {s.playerName} · {s.legend ? (bySlug.get(s.legend)?.champion ?? s.legend) : "—"}
                </Link>
                <p className="truncate text-muted">{s.eventName} · {f.date(s.createdAt)}</p>
              </div>
              <span
                className={`rounded px-1.5 py-0.5 text-xs ${s.status === "approved" ? "bg-good/15 text-good" : s.status === "rejected" ? "bg-bad/15 text-bad" : "bg-surface-2 text-muted"}`}
                title={s.rejectReason ? ts(`reasons.${s.rejectReason}`) : undefined}
              >
                {ts(`status.${s.status}`)}
              </span>
              {s.status !== "approved" && (
                <form action={deleteSubmissionAction}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="next" value={here} />
                  <button className="text-xs text-muted hover:text-bad">{ts("delete")}</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
