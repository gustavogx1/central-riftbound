import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DeckCardItem } from "@/components/DeckCardItem";
import { getPathname, Link, redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { signOut } from "@/lib/auth/actions";
import { getSessionUser } from "@/lib/auth/server";
import { renameAction } from "@/lib/deck-actions";
import { listMyDecks, MAX_DECKS_PER_USER } from "@/lib/decks";
import { getLegends } from "@/lib/queries";

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
  const [decks, legends] = await Promise.all([listMyDecks(user!.id), getLegends()]);
  const byCard = new Map(legends.map((l) => [l.cardId, l]));
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
    </div>
  );
}
