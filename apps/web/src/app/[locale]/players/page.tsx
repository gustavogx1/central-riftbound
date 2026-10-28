import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { makeFormat } from "@/lib/format";
import { searchPlayers } from "@/lib/queries";

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
  const f = makeFormat(locale);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 60) : "";
  // Com ?vs=<id>, a busca serve para escolher o adversário do head-to-head.
  const vs = Number(sp.vs) || null;
  const rows = q.length >= 2 ? await searchPlayers(q) : [];

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
                  <span className="font-medium">{p.name}</span>
                  <span className="text-sm text-muted">{t("eventsCount", { n: f.num(p.events) })}</span>
                </Link>
              </li>
            ))}
          </ul>
        )
      )}
      <p className="mt-8 text-xs text-muted">{t("privacy")}</p>
    </div>
  );
}
