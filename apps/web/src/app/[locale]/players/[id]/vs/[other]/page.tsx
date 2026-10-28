import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PlayerMatches } from "@/components/PlayerMatches";
import { Link } from "@/i18n/navigation";
import { getLegendsBySlugs, getPlayer, getPlayerMatches } from "@/lib/queries";

export const revalidate = 600;

async function load(id: string, other: string) {
  if (!Number.isInteger(Number(id)) || !Number.isInteger(Number(other)) || id === other) return null;
  const [a, b] = await Promise.all([getPlayer(Number(id)), getPlayer(Number(other))]);
  return a && b ? { a, b } : null;
}

export async function generateMetadata({ params }: PageProps<"/[locale]/players/[id]/vs/[other]">): Promise<Metadata> {
  const { id, other } = await params;
  const pair = await load(id, other);
  return { title: pair ? `${pair.a.name} vs ${pair.b.name}` : undefined };
}

export default async function HeadToHeadPage({ params }: PageProps<"/[locale]/players/[id]/vs/[other]">) {
  const { locale, id, other } = await params;
  setRequestLocale(locale);
  const pair = await load(id, other);
  if (!pair) notFound();
  const { a, b } = pair;
  const t = await getTranslations("Player");
  const matches = await getPlayerMatches(a.id, { vs: b.id });
  const legends = await getLegendsBySlugs(matches.flatMap((m) => [m.legend, m.opponentLegend]).filter((x): x is string => Boolean(x)));
  const count = (r: "win" | "loss" | "draw") => matches.filter((m) => m.result === r).length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <p className="text-sm text-muted">{t("headToHead")}</p>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-xl border border-border bg-surface p-6 text-center">
        <Link href={`/players/${a.id}`} className="min-w-0 truncate font-display text-xl font-bold hover:text-accent md:text-2xl">{a.name}</Link>
        <span className="font-display text-3xl font-bold tabular-nums md:text-5xl">
          {count("win")}<span className="px-2 text-muted">–</span>{count("loss")}
        </span>
        <Link href={`/players/${b.id}`} className="min-w-0 truncate font-display text-xl font-bold hover:text-accent md:text-2xl">{b.name}</Link>
        <span className="col-span-3 text-sm text-muted">{t("h2hSummary", { matches: matches.length, draws: count("draw") })}</span>
      </div>
      <div className="mt-8">
        {matches.length ? <PlayerMatches rows={matches} legends={legends} showOpponent={false} /> : <p className="text-muted">{t("neverMet")}</p>}
      </div>
    </div>
  );
}
