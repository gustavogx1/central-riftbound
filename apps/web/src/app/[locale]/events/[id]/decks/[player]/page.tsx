import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { decodeDeck } from "@cr/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CopyButton } from "@/components/CopyButton";
import { DeckShowcase } from "@/components/deck/DeckShowcase";
import { Link } from "@/i18n/navigation";
import { poolMap } from "@/lib/decks";
import { getEventDeck, topdeckDeckUrl } from "@/lib/event-decks";
import { makeFormat } from "@/lib/format";
import { getLegendsBySlugs } from "@/lib/queries";

async function load(id: string, player: string) {
  return Number.isInteger(Number(id)) ? getEventDeck(Number(id), decodeURIComponent(player)) : null;
}

export async function generateMetadata({ params }: PageProps<"/[locale]/events/[id]/decks/[player]">): Promise<Metadata> {
  const { id, player } = await params;
  const d = await load(id, player);
  return d ? { title: `${d.hidden ? "Deck" : d.name} · ${d.eventName}` } : { robots: { index: false } };
}

/** Decklist de um jogador num torneio, como o TopDeck.gg publicou. */
export default async function EventDeckPage({ params }: PageProps<"/[locale]/events/[id]/decks/[player]">) {
  const { locale, id, player } = await params;
  setRequestLocale(locale);
  const row = await load(id, player);
  if (!row?.code) notFound();
  const t = await getTranslations("EventDeck");
  const tb = await getTranslations("Builder");
  const tc = await getTranslations("Common");
  const f = makeFormat(locale);
  const pool = await poolMap();
  const { deck } = decodeDeck(row.code, pool);
  const legend = row.legend ? (await getLegendsBySlugs([row.legend])).get(row.legend) : undefined;
  const name = row.hidden ? tc("hiddenPlayer") : row.name;
  const deckName = t("deckName", { player: name, event: row.eventName });
  const placed = row.rank !== null ? t("placed", { rank: row.rank, players: row.playerCount }) : "";
  const btn = "rounded-md border border-border bg-bg/60 px-3 py-1.5 text-sm hover:border-accent";

  return (
    <>
      <DeckShowcase
        deck={deck}
        pool={pool}
        title={row.playerId && !row.hidden ? <Link href={`/players/${row.playerId}`} className="hover:text-accent">{name}</Link> : name}
        titleText={name}
        kicker={`${legend ? `${legend.champion}, ${legend.title}` : "—"} · ${f.date(new Date(row.startsAt))}`}
        byline={[row.eventName, placed].filter(Boolean).join(" · ")}
        btnClass={btn}
        meta={
          <p className="text-sm text-muted">
            <Link href={{ pathname: `/events/${id}`, query: { view: "decks" } }} className="hover:text-text">{row.eventName}</Link>
            {placed && <> · {placed}</>}
          </p>
        }
        actions={
          <>
            <Link href={{ pathname: "/builder", query: { code: row.code, name: deckName } }} className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink">
              {t("copyToBuilder")}
            </Link>
            <CopyButton value={row.code} label={tb("copyCode")} done={tb("copied")} className={btn} />
            <Link href={{ pathname: "/builder/print", query: { code: row.code, name: deckName } }} className={btn}>{tb("print")}</Link>
            <a href={topdeckDeckUrl(row.tid, row.topdeckPlayerId)} target="_blank" rel="noopener noreferrer" className={btn}>{t("onTopdeck")} ↗</a>
          </>
        }
      />
      <p className="mx-auto max-w-6xl px-4 pb-10 text-xs text-muted">
        {t.rich("credit", {
          link: (c) => (
            <a href={topdeckDeckUrl(row.tid, row.topdeckPlayerId)} target="_blank" rel="noopener noreferrer" className="text-accent underline">{c}</a>
          ),
        })}
      </p>
    </>
  );
}
