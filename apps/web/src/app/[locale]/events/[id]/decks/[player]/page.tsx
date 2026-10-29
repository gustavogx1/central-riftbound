import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { decodeDeck } from "@cr/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CopyButton } from "@/components/CopyButton";
import { DeckShowcase } from "@/components/deck/DeckShowcase";
import { SpiceBadge } from "@/components/deck/SpiceBadge";
import { Link } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth/server";
import { getDeckSpice } from "@/lib/card-stats";
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
  if (!d || (d.source === "community" && d.status !== "approved")) return { robots: { index: false } };
  return { title: `${d.hidden ? "Deck" : d.name} · ${d.eventName}` };
}

/** Decklist de um jogador num torneio: publicada no TopDeck.gg ou enviada pela comunidade. */
export default async function EventDeckPage({ params }: PageProps<"/[locale]/events/[id]/decks/[player]">) {
  const { locale, id, player } = await params;
  setRequestLocale(locale);
  const row = await load(id, player);
  if (!row?.code) notFound();
  const community = row.source === "community";
  // Lista da comunidade ainda não aprovada: só quem enviou e a moderação veem.
  const user = community && row.status !== "approved" ? await getSessionUser() : null;
  if (community && row.status !== "approved" && !(user && (user.admin || user.id === row.userId))) notFound();
  const t = await getTranslations("EventDeck");
  const tb = await getTranslations("Builder");
  const tc = await getTranslations("Common");
  const f = makeFormat(locale);
  const pool = await poolMap();
  const { deck } = decodeDeck(row.code, pool);
  const [legends, spice] = await Promise.all([
    row.legend ? getLegendsBySlugs([row.legend]) : Promise.resolve(new Map()),
    getDeckSpice(deck, row.legend, row.metagame, { eventId: Number(id), key: row.key }),
  ]);
  const legend = row.legend ? legends.get(row.legend) : undefined;
  const name = row.hidden ? tc("hiddenPlayer") : row.name;
  const deckName = t("deckName", { player: name, event: row.eventName });
  const placed = row.rank !== null ? t("placed", { rank: row.rank, players: row.playerCount }) : "";
  const btn = "rounded-md border border-border bg-bg/60 px-3 py-1.5 text-sm hover:border-accent";

  return (
    <>
      {community && row.status !== "approved" && (
        <p role="status" className={`mx-auto mt-4 max-w-6xl rounded-md px-4 py-2 text-sm ${row.status === "rejected" ? "bg-bad/15 text-bad" : "bg-surface-2 text-muted"}`}>
          {row.status === "rejected" ? t("rejected") : t("pending")}
        </p>
      )}
      <DeckShowcase
        deck={deck}
        pool={pool}
        title={row.playerId && !row.hidden ? <Link href={`/players/${row.playerId}`} className="hover:text-accent">{name}</Link> : name}
        titleText={name}
        kicker={`${legend ? `${legend.champion}, ${legend.title}` : "—"} · ${f.date(new Date(row.startsAt))}`}
        byline={[row.eventName, placed].filter(Boolean).join(" · ")}
        btnClass={btn}
        meta={
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>
              <Link href={{ pathname: `/events/${id}`, query: { view: "decks" } }} className="hover:text-text">{row.eventName}</Link>
              {placed && <> · {placed}</>}
            </span>
            {spice && <SpiceBadge value={spice.value} compared={spice.compared} />}
          </div>
        }
        actions={
          <>
            <Link href={{ pathname: "/builder", query: { code: row.code, name: deckName } }} className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink">
              {t("copyToBuilder")}
            </Link>
            <CopyButton value={row.code} label={tb("copyCode")} done={tb("copied")} className={btn} />
            <Link href={{ pathname: "/builder/print", query: { code: row.code, name: deckName } }} className={btn}>{tb("print")}</Link>
            {row.source === "topdeck" && row.tid && (
              <a href={topdeckDeckUrl(row.tid, row.key)} target="_blank" rel="noopener noreferrer" className={btn}>{t("onTopdeck")} ↗</a>
            )}
          </>
        }
      >
        {community && row.note && <p className="mt-6 max-w-3xl whitespace-pre-line text-muted">{row.note}</p>}
      </DeckShowcase>
      <p className="mx-auto max-w-6xl px-4 pb-10 text-xs text-muted">
        {row.source === "topdeck" && row.tid
          ? t.rich("credit", {
              link: (c) => (
                <a href={topdeckDeckUrl(row.tid!, row.key)} target="_blank" rel="noopener noreferrer" className="text-accent underline">{c}</a>
              ),
            })
          : row.sourceUrl
            ? t.rich("creditCommunitySource", {
                link: (c) => (
                  <a href={row.sourceUrl!} target="_blank" rel="noopener noreferrer nofollow" className="text-accent underline">{c}</a>
                ),
              })
            : t("creditCommunity")}
      </p>
    </>
  );
}
