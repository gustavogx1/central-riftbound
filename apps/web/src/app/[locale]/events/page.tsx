import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegendAvatar } from "@/components/LegendAvatar";
import { Link } from "@/i18n/navigation";
import { makeFormat } from "@/lib/format";
import { getEvents, getLegendsBySlugs } from "@/lib/queries";

export const revalidate = 600;

export async function generateMetadata({ params }: PageProps<"/[locale]/events">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Events" });
  return { title: t("title"), description: t("lead") };
}

export default async function EventsPage({ params }: PageProps<"/[locale]/events">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Events");
  const tc = await getTranslations("Common");
  const ts = await getTranslations("Sets");
  const f = makeFormat(locale);
  const events = await getEvents();
  const legends = await getLegendsBySlugs(events.map((e) => e.winnerLegend).filter((x): x is string => Boolean(x)));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold md:text-4xl">{t("title")}</h1>
      <p className="mt-3 max-w-3xl text-muted">{t("lead")}</p>
      {events.length === 0 ? (
        <p className="mt-12 rounded-xl border border-border bg-surface p-6 text-muted">{tc("noData")}</p>
      ) : (
        <ul className="mt-8 divide-y divide-border overflow-hidden rounded-xl border border-border">
          {events.map((e) => {
            const w = e.winnerLegend ? legends.get(e.winnerLegend) : undefined;
            return (
              <li key={e.id}>
                <Link href={`/events/${e.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-surface px-4 py-3 transition hover:bg-surface-2">
                  <span className="w-28 shrink-0 text-sm tabular-nums text-muted">{f.date(e.startsAt)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{e.name}</span>
                    <span className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted">
                      <span className={`rounded px-1.5 py-px ${e.kind === "main" ? "bg-accent text-accent-ink" : "bg-surface-2"}`}>{t(e.kind as "main")}</span>
                      {e.metagame && <span>{ts(e.metagame as "all")}</span>}
                      <span>{f.num(e.playerCount)} {tc("players").toLowerCase()}</span>
                    </span>
                  </span>
                  {w && (
                    <span className="flex items-center gap-2 text-sm">
                      <span className="text-xs text-muted">{t("winner")}</span>
                      <LegendAvatar cardId={w.cardId} champion={w.champion} domains={w.domains} size={28} />
                      <span>
                        <span className="block font-medium">{e.winnerHidden ? tc("hiddenPlayer") : e.winnerName}</span>
                        <span className="block text-xs text-muted">{w.champion}</span>
                      </span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
