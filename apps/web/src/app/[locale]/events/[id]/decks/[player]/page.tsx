import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { decodeDeck, energyCurve, fullName, listName, mainCount, type PoolCard } from "@cr/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CopyButton } from "@/components/CopyButton";
import { DomainDots } from "@/components/DomainDots";
import { LegendAvatar } from "@/components/LegendAvatar";
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

type Row = readonly [PoolCard, number];

function Block({ title, rows, total }: { title: string; rows: Row[]; total?: number }) {
  return (
    <section>
      <h2 className="flex justify-between border-b border-border pb-1 font-display text-sm font-semibold">
        <span>{title}</span>
        {total !== undefined && <span className="text-muted">{total}</span>}
      </h2>
      <ul className="mt-1 space-y-0.5 text-sm">
        {rows.map(([c, n]) => (
          <li key={c.id} className="flex items-center gap-2" title={c.rulesText || undefined}>
            <span className="w-5 text-right font-display font-bold tabular-nums">{n}</span>
            <span className="w-4 text-center text-xs text-muted">{c.energyCost ?? ""}</span>
            <DomainDots domains={c.domains} />
            <span className="truncate">{c.type === "Legend" ? listName(c) : fullName(c)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Decklist de um jogador num torneio, como o TopDeck.gg publicou. */
export default async function EventDeckPage({ params }: PageProps<"/[locale]/events/[id]/decks/[player]">) {
  const { locale, id, player } = await params;
  setRequestLocale(locale);
  const row = await load(id, player);
  if (!row?.code) notFound();
  const t = await getTranslations("EventDeck");
  const tb = await getTranslations("Builder");
  const tt = await getTranslations("Types");
  const tc = await getTranslations("Common");
  const f = makeFormat(locale);
  const pool = await poolMap();
  const { deck } = decodeDeck(row.code, pool);
  const legend = row.legend ? (await getLegendsBySlugs([row.legend])).get(row.legend) : undefined;
  const name = row.hidden ? tc("hiddenPlayer") : row.name;

  const rows = (r: Record<string, number>): Row[] =>
    Object.entries(r)
      .map(([cid, n]) => [pool.get(cid), n] as const)
      .filter((x): x is Row => !!x[0])
      .sort(([a], [b]) => (a.energyCost ?? 99) - (b.energyCost ?? 99) || fullName(a).localeCompare(fullName(b)));
  const one = (ids: (string | null)[]): Row[] => ids.map((cid) => (cid ? pool.get(cid) : undefined)).filter((c): c is PoolCard => !!c).map((c) => [c, 1] as const);
  const main = rows(deck.main);
  const sum = (r: Row[]) => r.reduce((a, [, n]) => a + n, 0);
  const curve = energyCurve(deck, pool);
  const peak = Math.max(1, ...curve);
  const deckName = t("deckName", { player: name, event: row.eventName });
  const btn = "rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent";

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <p className="text-sm text-muted">
        <Link href={{ pathname: `/events/${id}`, query: { view: "decks" } }} className="hover:text-text">{row.eventName}</Link> / {f.date(new Date(row.startsAt))}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        {legend && <LegendAvatar cardId={legend.cardId} champion={legend.champion} domains={legend.domains} size={64} />}
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-bold break-words">
            {row.playerId && !row.hidden ? <Link href={`/players/${row.playerId}`} className="hover:text-accent">{name}</Link> : name}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {legend ? `${legend.champion}, ${legend.title}` : "—"}
            {row.rank !== null && <> · {t("placed", { rank: row.rank, players: row.playerCount })}</>}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href={{ pathname: "/builder", query: { code: row.code, name: deckName } }} className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink">
          {t("copyToBuilder")}
        </Link>
        <CopyButton value={row.code} label={tb("copyCode")} done={tb("copied")} className={btn} />
        <Link href={{ pathname: "/builder/print", query: { code: row.code, name: deckName } }} className={btn}>{tb("print")}</Link>
        <a href={topdeckDeckUrl(row.tid, row.topdeckPlayerId)} target="_blank" rel="noopener noreferrer" className={btn}>{t("onTopdeck")} ↗</a>
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-[1fr_1.4fr]">
        <div className="space-y-5">
          <Block title={tb("legend")} rows={one([deck.legend])} />
          {deck.extraLegends.length > 0 && <Block title={tb("extraLegendsTitle")} rows={one(deck.extraLegends)} />}
          <Block title={tb("champion")} rows={one([deck.champion])} />
          <Block title={tb("battlefields")} rows={one(deck.battlefields)} total={deck.battlefields.length} />
          <Block title={tb("runes")} rows={rows(deck.runes)} total={sum(rows(deck.runes))} />
          {Object.keys(deck.side).length > 0 && <Block title={tb("side")} rows={rows(deck.side)} total={sum(rows(deck.side))} />}
        </div>
        <div className="space-y-5">
          <div aria-label={tb("curve")} role="img" className="flex h-24 items-end gap-1 rounded-xl border border-border bg-surface p-3">
            {curve.map((n, cost) => (
              <div key={cost} className="flex flex-1 flex-col items-center gap-0.5 text-[11px] text-muted">
                <span>{n || ""}</span>
                <span className="w-full rounded-t bg-accent/70" style={{ height: `${(n / peak) * 44}px` }} />
                <span>{cost === 7 ? "7+" : cost}</span>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted">{tb("printMainTotal", { count: mainCount(deck) })}</p>
          {(["Unit", "Spell", "Gear"] as const).map((type) => {
            const r = main.filter(([c]) => c.type === type);
            return r.length ? <Block key={type} title={tt(type)} rows={r} total={sum(r)} /> : null;
          })}
        </div>
      </div>
      <p className="mt-8 text-xs text-muted">
        {t.rich("credit", {
          link: (c) => (
            <a href={topdeckDeckUrl(row.tid, row.topdeckPlayerId)} target="_blank" rel="noopener noreferrer" className="text-accent underline">{c}</a>
          ),
        })}
      </p>
    </div>
  );
}
