"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { LegendAvatar } from "@/components/LegendAvatar";
import { makeFormat } from "@/lib/format";

export interface MatrixLegend {
  slug: string;
  champion: string;
  title: string;
  cardId: string;
  domains: string[];
  share: number;
  /** Sem poder (ex.: matriz de um evento só), a opção de ordenar por poder some. */
  power?: number;
  winRate: number | null;
  href: string;
}

type Sort = "share" | "power" | "winRate" | "name";
type Show = "winRate" | "matches";

const MIN_OPTIONS = [0, 10, 30, 50, 100] as const;
const TOP_PRESETS = [10, 20] as const;

/** Matriz de matchups com filtros no cliente: lendas, ordem, mínimo de partidas e valor exibido. */
export function MatchupMatrix({ legends, cells, locale, defaultMin, minOptions = MIN_OPTIONS }: {
  legends: MatrixLegend[];
  /** "linha|coluna" → [vitórias, derrotas] */
  cells: Record<string, [number, number]>;
  locale: string;
  defaultMin: number;
  minOptions?: readonly number[];
}) {
  const t = useTranslations("Meta");
  const f = makeFormat(locale);
  const [sort, setSort] = useState<Sort>("share");
  const [show, setShow] = useState<Show>("winRate");
  const [min, setMin] = useState(defaultMin);
  const [hideLow, setHideLow] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(legends.map((l) => l.slug)));
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const [hover, setHover] = useState<{ r: string; c: string } | null>(null);

  const byShare = useMemo(() => [...legends].sort((a, b) => b.share - a.share), [legends]);
  const rows = useMemo(() => {
    const list = legends.filter((l) => selected.has(l.slug));
    const cmp: Record<Sort, (a: MatrixLegend, b: MatrixLegend) => number> = {
      share: (a, b) => b.share - a.share,
      power: (a, b) => (b.power ?? 0) - (a.power ?? 0),
      winRate: (a, b) => (b.winRate ?? -1) - (a.winRate ?? -1),
      name: (a, b) => a.champion.localeCompare(b.champion, locale),
    };
    return list.sort(cmp[sort]);
  }, [legends, selected, sort, locale]);

  const preset = (n: number | null) => setSelected(new Set((n === null ? byShare : byShare.slice(0, n)).map((l) => l.slug)));
  const toggle = (slug: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  const activePreset = selected.size === legends.length ? "all" : TOP_PRESETS.find((n) => selected.size === Math.min(n, legends.length) && byShare.slice(0, n).every((l) => selected.has(l.slug)));

  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs transition ${active ? "border-accent bg-surface-2 text-text" : "border-border text-muted hover:bg-surface hover:text-text"}`;
  const q = query.trim().toLowerCase();
  const pickList = q ? byShare.filter((l) => `${l.champion} ${l.title}`.toLowerCase().includes(q)) : byShare;

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("matrixLegends")}>
          <span className="text-muted">{t("matrixLegends")}</span>
          {TOP_PRESETS.filter((n) => n < legends.length).map((n) => (
            <button key={n} type="button" className={pill(activePreset === n)} onClick={() => preset(n)}>{t("matrixTop", { n })}</button>
          ))}
          <button type="button" className={pill(activePreset === "all")} onClick={() => preset(null)}>{t("matrixAll", { n: legends.length })}</button>
          <button type="button" className={pill(picking)} aria-expanded={picking} onClick={() => setPicking((v) => !v)}>
            {t("matrixPick", { n: selected.size })}
          </button>
        </div>
        <label className="flex items-center gap-2">
          <span className="text-muted">{t("matrixSort")}</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-md border border-border bg-surface px-2 py-1 text-xs">
            <option value="share">{t("matrixSortShare")}</option>
            {legends.some((l) => l.power !== undefined) && <option value="power">{t("matrixSortPower")}</option>}
            <option value="winRate">{t("matrixSortWinRate")}</option>
            <option value="name">{t("matrixSortName")}</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted">{t("matrixMin")}</span>
          <select value={min} onChange={(e) => setMin(Number(e.target.value))} className="rounded-md border border-border bg-surface px-2 py-1 text-xs">
            {minOptions.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-muted">
          <input type="checkbox" checked={hideLow} onChange={(e) => setHideLow(e.target.checked)} className="accent-[var(--accent)]" />
          {t("matrixHideLow")}
        </label>
        <div className="flex items-center gap-2" role="group" aria-label={t("matrixShow")}>
          <span className="text-muted">{t("matrixShow")}</span>
          <button type="button" className={pill(show === "winRate")} onClick={() => setShow("winRate")}>{t("matrixShowWinRate")}</button>
          <button type="button" className={pill(show === "matches")} onClick={() => setShow("matches")}>{t("matrixShowMatches")}</button>
        </div>
      </div>

      {picking && (
        <div className="mt-3 rounded-xl border border-border bg-surface p-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("matrixSearch")}
              className="w-56 rounded-md border border-border bg-bg px-2 py-1 text-sm"
            />
            <button type="button" className={pill(false)} onClick={() => preset(null)}>{t("matrixSelectAll")}</button>
            <button type="button" className={pill(false)} onClick={() => setSelected(new Set())}>{t("matrixClear")}</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {pickList.map((l) => {
              const on = selected.has(l.slug);
              return (
                <button
                  key={l.slug}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(l.slug)}
                  className={`flex items-center gap-2 rounded-full border py-0.5 pl-0.5 pr-3 text-xs transition ${on ? "border-accent bg-surface-2 text-text" : "border-border text-muted opacity-60 hover:opacity-100"}`}
                  title={`${l.champion}, ${l.title}`}
                >
                  <LegendAvatar cardId={l.cardId} champion={l.champion} domains={l.domains} size={22} />
                  {l.champion}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {rows.length < 2 ? (
        <p className="mt-4 rounded-xl border border-border bg-surface p-4 text-sm text-muted">{t("matrixTooFew")}</p>
      ) : (
        <div className="mx-auto mt-4 max-h-[75vh] w-fit max-w-full overflow-auto rounded-xl border border-border" onMouseLeave={() => setHover(null)}>
          <table className="border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-30 bg-surface p-2" />
                {rows.map((c) => (
                  <th key={c.slug} scope="col" className={`sticky top-0 z-20 p-1.5 ${hover?.c === c.slug ? "bg-surface-2" : "bg-surface"}`} title={`${c.champion}, ${c.title}`}>
                    <span className="flex justify-center"><LegendAvatar cardId={c.cardId} champion={c.champion} domains={c.domains} size={28} /></span>
                    <span className="sr-only">{c.champion}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.slug}>
                  <th scope="row" className={`sticky left-0 z-10 whitespace-nowrap px-3 py-1.5 text-left font-medium ${hover?.r === r.slug ? "bg-surface-2" : "bg-surface"}`}>
                    <a href={r.href} className="hover:text-accent">{r.champion}</a>
                  </th>
                  {rows.map((c) => {
                    const cross = hover !== null && (hover.r === r.slug || hover.c === c.slug);
                    const base = `min-w-11 border-l border-t border-border px-2 py-1.5 text-center tabular-nums ${cross ? "outline outline-1 -outline-offset-1 outline-accent/40" : ""}`;
                    if (r.slug === c.slug) return <td key={c.slug} className={`${base} text-muted`}>—</td>;
                    const [w, l] = cells[`${r.slug}|${c.slug}`] ?? [0, 0];
                    const n = w + l;
                    const wr = n ? w / n : null;
                    const low = n < min;
                    const hidden = low && hideLow;
                    const strength = wr === null || hidden ? 0 : Math.min(1, Math.abs(wr - 0.5) * 4);
                    const bg = strength === 0 ? "transparent" : wr! >= 0.5 ? `color-mix(in oklab, var(--tier-c) ${strength * 55}%, transparent)` : `color-mix(in oklab, var(--tier-s) ${strength * 55}%, transparent)`;
                    const text = n === 0 || hidden ? "" : show === "winRate" ? f.pct(wr, 0) : f.num(n);
                    return (
                      <td
                        key={c.slug}
                        className={base}
                        style={{ background: bg, opacity: low && !hidden ? 0.45 : 1 }}
                        title={t("matrixCell", { row: r.champion, col: c.champion, wr: f.pct(wr), n })}
                        onMouseEnter={() => setHover({ r: r.slug, c: c.slug })}
                      >
                        {text}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
