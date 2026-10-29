import type { ReactNode } from "react";
import { energyCurve, fullName, mainCount, type DeckList, type PoolCard } from "@cr/core";
import { getTranslations } from "next-intl/server";
import { domainColor } from "@/components/LegendAvatar";
import { DomainDots } from "@/components/DomainDots";
import { Link } from "@/i18n/navigation";
import { cardImage, hasImages } from "@/lib/images";
import type { ExportCard, ExportDeck } from "@/lib/deck-image";
import { CardHover } from "./CardHover";
import { cardName, DeckImages, SectionTitle, type DeckRow, type DeckSection } from "./DeckImages";
import { DeckExport } from "./DeckExport";
import { DeckViewToggle } from "./DeckViewToggle";

/** Cores dos domínios em hex, para o canvas (que não entende var(--…)). Iguais às do globals.css. */
const DOMAIN_HEX: Record<string, string> = {
  Fury: "#e5484d",
  Calm: "#46a758",
  Mind: "#3e8ee0",
  Body: "#f08c32",
  Chaos: "#9b6fd6",
  Order: "#e0c14a",
};

const byCost = ([a]: DeckRow, [b]: DeckRow) => (a.energyCost ?? 99) - (b.energyCost ?? 99) || fullName(a).localeCompare(fullName(b));
const sum = (r: DeckRow[]) => r.reduce((a, [, n]) => a + n, 0);

function ListBlock({ title, rows, total }: DeckSection) {
  return (
    <section>
      <h2 className="flex justify-between border-b border-border pb-1 font-display text-sm font-semibold">
        <span>{title}</span>
        {total !== undefined && <span className="text-muted">{total}</span>}
      </h2>
      <ul className="mt-1 space-y-0.5 text-sm">
        {rows.map(([c, n]) => (
          <li key={c.id} className="flex items-center gap-2" title={hasImages ? undefined : c.rulesText || undefined}>
            <span className="w-5 text-right font-display font-bold tabular-nums">{n}</span>
            <span className="w-4 text-center text-xs text-muted">{c.energyCost ?? ""}</span>
            <DomainDots domains={c.domains} />
            <CardHover src={cardImage(c.id, 744)} lowSrc={cardImage(c.id)} landscape={c.type === "Battlefield"} className="truncate">
              <Link href={`/cards/${c.code}`} className="hover:text-accent">{cardName(c)}</Link>
            </CardHover>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Bars({ title, values, labels }: { title: string; values: number[]; labels: string[] }) {
  const peak = Math.max(1, ...values);
  return (
    <div>
      <p className="font-display text-xs font-semibold tracking-[0.18em] text-muted uppercase">{title}</p>
      <div className="mt-3 flex h-32 items-end gap-1.5">
        {values.map((n, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1 text-xs text-muted">
            <span className={n ? "font-semibold text-text" : ""}>{n}</span>
            <span className="w-full rounded-t bg-gradient-to-t from-accent to-accent-2" style={{ height: `${(n / peak) * 80}px`, minHeight: n ? 3 : 1 }} />
            <span>{labels[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Meters({ title, items }: { title: string; items: { key: string; label: string; value: number; color?: string }[] }) {
  const peak = Math.max(1, ...items.map((i) => i.value));
  return (
    <div>
      <p className="font-display text-xs font-semibold tracking-[0.18em] text-muted uppercase">{title}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((i) => (
          <li key={i.key} className="grid grid-cols-[5.5rem_1fr_2rem] items-center gap-2">
            <span className="flex items-center gap-1.5 truncate">
              {i.color && <span className="size-2.5 shrink-0 rounded-full" style={{ background: i.color }} />}
              {i.label}
            </span>
            <span className="h-1.5 rounded-full bg-surface-2">
              <span className="block h-full rounded-full" style={{ width: `${(i.value / peak) * 100}%`, background: i.color ?? "var(--accent)" }} />
            </span>
            <span className="text-right font-semibold tabular-nums">{i.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface DeckShowcaseProps {
  deck: DeckList;
  pool: Map<string, PoolCard>;
  /** Título na página (pode ter link); `titleText` vai para a imagem exportada. */
  title: ReactNode;
  titleText: string;
  /** Linha pequena acima do título (lenda, data). */
  kicker: string;
  /** Autor ou colocação, para a imagem exportada. */
  byline: string;
  /** Selos e textos logo abaixo do título. */
  meta?: ReactNode;
  /** Botões de ação; o de exportar entra no fim. */
  actions: ReactNode;
  /** Descrição, avisos etc., entre o topo e a decklist. */
  children?: ReactNode;
  btnClass: string;
}

/** Página de deck no estilo vitrine: topo com lenda e campeão, grade de imagens (ou lista), estatísticas e exportação. */
export async function DeckShowcase({ deck, pool, title, titleText, kicker, byline, meta, actions, children, btnClass }: DeckShowcaseProps) {
  const t = await getTranslations("DeckView");
  const tb = await getTranslations("Builder");
  const tt = await getTranslations("Types");
  const td = await getTranslations("Domains");

  const rows = (r: Record<string, number>): DeckRow[] =>
    Object.entries(r)
      .map(([cid, n]) => [pool.get(cid), n] as const)
      .filter((x): x is DeckRow => !!x[0])
      .sort(byCost);
  const one = (ids: (string | null)[]): DeckRow[] => ids.map((cid) => (cid ? pool.get(cid) : undefined)).filter((c): c is PoolCard => !!c).map((c) => [c, 1] as const);

  const legend = deck.legend ? pool.get(deck.legend) : undefined;
  const champion = deck.champion ? pool.get(deck.champion) : undefined;
  // Na grade o campeão escolhido volta para o deck principal, para a conta fechar em 40.
  const mainAll = rows({ ...deck.main, ...(deck.champion ? { [deck.champion]: (deck.main[deck.champion] ?? 0) + 1 } : {}) });
  const main = rows(deck.main);
  const runes = rows(deck.runes);
  const side = rows(deck.side);
  const battlefields = one(deck.battlefields);
  const byType = (["Unit", "Spell", "Gear"] as const).flatMap((type): DeckSection[] => {
    const r = main.filter(([c]) => c.type === type);
    return r.length ? [{ id: type, title: tt(type), rows: r, total: sum(r) }] : [];
  });
  const total = mainCount(deck);

  const runeSummary = runes.map(([c, n]) => ({ key: c.id, domain: c.domains[0] ?? "Colorless", count: n }));

  // Estatísticas do deck principal (campeão incluído).
  const curve = energyCurve(deck, pool);
  const power = [0, 0, 0, 0];
  const domains = new Map<string, number>();
  const types = new Map<string, number>();
  for (const [c, n] of mainAll) {
    if (c.powerCost !== null) power[Math.min(c.powerCost, 3)]! += n;
    for (const d of c.domains) domains.set(d, (domains.get(d) ?? 0) + n);
    if (c.type) types.set(c.type, (types.get(c.type) ?? 0) + n);
  }

  const imageSections: DeckSection[] = [
    { id: "main", title: t("mainDeck"), rows: mainAll, total },
    { id: "battlefields", title: tb("battlefields"), rows: battlefields, total: battlefields.length },
    { id: "runes", title: tb("runes"), rows: runes, total: sum(runes) },
    { id: "side", title: tb("side"), rows: side, total: sum(side) },
  ];

  const listTop: DeckSection[] = [
    { id: "legend", title: tb("legend"), rows: one([deck.legend]) },
    ...(deck.extraLegends.length ? [{ id: "extra", title: tb("extraLegendsTitle"), rows: one(deck.extraLegends) }] : []),
    { id: "champion", title: tb("champion"), rows: one([deck.champion]) },
    { id: "battlefields", title: tb("battlefields"), rows: battlefields, total: battlefields.length },
    { id: "runes", title: tb("runes"), rows: runes, total: sum(runes) },
    ...(side.length ? [{ id: "side", title: tb("side"), rows: side, total: sum(side) }] : []),
  ];
  const list = (
    <div className="grid gap-8 md:grid-cols-[1fr_1.4fr]">
      <div className="space-y-5">
        {listTop.map((s) => (
          <ListBlock key={s.id} {...s} />
        ))}
      </div>
      <div className="space-y-5">
        <p className="text-sm text-muted">{tb("printMainTotal", { count: total })}</p>
        {byType.map((s) => (
          <ListBlock key={s.id} {...s} />
        ))}
      </div>
    </div>
  );

  const ex = (c: PoolCard, count: number): ExportCard => ({ src: cardImage(c.id), name: cardName(c), count, landscape: c.type === "Battlefield" });
  const exportDeck: ExportDeck = {
    title: titleText,
    kicker,
    byline,
    legend: legend ? ex(legend, 1) : null,
    champion: champion ? ex(champion, 1) : null,
    battlefields: battlefields.map(([c, n]) => ex(c, n)),
    main: mainAll.map(([c, n]) => ex(c, n)),
    runes: runes.map(([c, n]) => ex(c, n)),
    side: side.map(([c, n]) => ex(c, n)),
    runeSummary: runeSummary.map((r) => ({ color: DOMAIN_HEX[r.domain] ?? "#a39cc0", label: td(r.domain as "Fury"), count: r.count })),
    labels: { main: t("mainDeck"), battlefields: tb("battlefields"), runes: tb("runes"), side: tb("side"), legend: tb("legend"), champion: tb("champion"), site: "central-riftbound.vercel.app" },
  };

  const heroArt = champion ?? legend;
  const heroSrc = heroArt ? cardImage(heroArt.id, 744) : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="relative overflow-hidden rounded-2xl border border-border bg-surface">
        {heroSrc && (
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-80 bg-cover opacity-25 [mask-image:linear-gradient(to_bottom,black,transparent)] md:inset-y-0 md:right-0 md:left-auto md:h-auto md:w-2/3 md:opacity-30 md:[mask-image:linear-gradient(to_right,transparent,black_45%)]"
            style={{ backgroundImage: `url(${heroSrc})`, backgroundPosition: "center 15%" }}
          />
        )}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-accent/15 via-transparent to-accent-2/5" />
        <div className="relative flex flex-col gap-6 p-5 md:flex-row md:p-6">
          {(legend || champion) && (
            <div className="flex shrink-0 gap-3">
              {(
                [
                  [legend, tb("legend")],
                  [champion, tb("champion")],
                ] as const
              ).map(([c, label]) =>
                c ? (
                  <figure key={label} className="w-32 sm:w-40">
                    <CardHover src={cardImage(c.id, 744)} lowSrc={cardImage(c.id)} className="block">
                      {cardImage(c.id) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cardImage(c.id)!} alt={cardName(c)} width={372} height={519} className="w-full rounded-xl shadow-xl shadow-black/40" />
                      ) : (
                        <span className="grid aspect-[372/519] place-items-center rounded-xl bg-surface-2 p-2 text-center text-sm">{cardName(c)}</span>
                      )}
                    </CardHover>
                    <figcaption className="mt-2">
                      <span className="block font-display text-[10px] tracking-[0.18em] text-muted uppercase">{label}</span>
                      <span className="block truncate text-sm font-semibold">{cardName(c)}</span>
                    </figcaption>
                  </figure>
                ) : null,
              )}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 font-display text-xs font-semibold tracking-[0.18em] text-accent-2 uppercase">
              <span aria-hidden className="size-1.5 bg-accent-2" />
              {kicker}
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold break-words md:text-4xl">{title}</h1>
            {meta && <div className="mt-2">{meta}</div>}
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              {champion && (
                <>
                  <dt className="font-display text-[11px] tracking-[0.18em] text-muted uppercase">{tb("champion")}</dt>
                  <dd>{cardName(champion)}</dd>
                </>
              )}
              {runeSummary.length > 0 && (
                <>
                  <dt className="font-display text-[11px] tracking-[0.18em] text-muted uppercase">{tb("runes")}</dt>
                  <dd className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {runeSummary.map((r) => (
                      <span key={r.key} className="inline-flex items-center gap-1.5">
                        <span className="size-3 rounded-full" style={{ background: domainColor(r.domain) }} />
                        {r.count} {td(r.domain as "Fury")}
                      </span>
                    ))}
                  </dd>
                </>
              )}
              {battlefields.length > 0 && (
                <>
                  <dt className="font-display text-[11px] tracking-[0.18em] text-muted uppercase">{tb("battlefields")}</dt>
                  <dd>{battlefields.map(([c]) => cardName(c)).join(", ")}</dd>
                </>
              )}
            </dl>
            <div className="mt-5 flex flex-wrap gap-2">
              {actions}
              {hasImages && (
                <DeckExport
                  deck={exportDeck}
                  className={btnClass}
                  labels={{
                    button: t("export"),
                    vertical: t("vertical"),
                    horizontal: t("horizontal"),
                    format: t("format"),
                    orientation: t("orientation"),
                    download: t("download"),
                    working: t("working"),
                    error: t("exportError"),
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </header>

      {children}

      <DeckViewToggle
        list={list}
        images={hasImages ? <DeckImages sections={imageSections} /> : list}
        defaultView={hasImages ? "images" : "list"}
        labels={{ view: t("view"), list: t("viewList"), images: t("viewImages") }}
      />

      <section className="mt-10">
        <SectionTitle title={t("stats")} />
        <p className="mt-1 text-xs text-muted">{t("statsSub", { count: total })}</p>
        <div className="mt-4 grid gap-6 rounded-2xl border border-border bg-surface p-5 md:grid-cols-[1.4fr_0.8fr_1fr_1fr]">
          <Bars title={t("energy")} values={curve} labels={curve.map((_, i) => (i === 7 ? "7+" : String(i)))} />
          <Bars title={t("power")} values={power} labels={["0", "1", "2", "3+"]} />
          <Meters
            title={t("domains")}
            items={[...domains].sort((a, b) => b[1] - a[1]).map(([d, n]) => ({ key: d, label: td(d as "Fury"), value: n, color: domainColor(d) }))}
          />
          <Meters title={t("types")} items={(["Unit", "Spell", "Gear"] as const).filter((x) => types.get(x)).map((x) => ({ key: x, label: tt(x), value: types.get(x)! }))} />
        </div>
      </section>
    </div>
  );
}

