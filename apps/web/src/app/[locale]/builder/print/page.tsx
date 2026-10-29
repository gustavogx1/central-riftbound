import type { Metadata } from "next";
import { decodeDeck, fullName, listName, mainCount, type PoolCard } from "@cr/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PrintButton } from "@/components/builder/PrintButton";
import { Link } from "@/i18n/navigation";
import { getCardPool } from "@/lib/queries";

export async function generateMetadata({ params }: PageProps<"/[locale]/builder/print">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Builder" });
  return { title: t("printTitle"), robots: { index: false } };
}

const str = (v: string | string[] | undefined, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function Block({ title, items, total }: { title: string; items: readonly (readonly [string, number])[]; total?: number }) {
  return (
    <section className="break-inside-avoid">
      <h2 className="border-b border-current pb-1 font-display text-sm font-bold uppercase">
        {title}
        {total !== undefined && <span className="float-right">{total}</span>}
      </h2>
      <table className="mt-1 w-full text-sm">
        <tbody>
          {items.map(([label, n]) => (
            <tr key={label} className="border-b border-current/20">
              <td className="w-8 py-0.5 font-bold tabular-nums">{n}</td>
              <td className="py-0.5">{label}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** Folha para imprimir ou salvar em PDF: a lista no formato de inscrição de torneio. */
export default async function PrintPage({ params, searchParams }: PageProps<"/[locale]/builder/print">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("Builder");
  const tt = await getTranslations("Types");
  const pool = new Map((await getCardPool()).map((c) => [c.id, c]));
  const code = str(sp.code, 400);
  const name = str(sp.name, 80);

  let decoded: ReturnType<typeof decodeDeck> | null = null;
  try {
    decoded = code ? decodeDeck(code, pool) : null;
  } catch {
    decoded = null;
  }
  if (!decoded) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-muted">{t("importInvalid")}</p>
        <Link href="/builder" className="mt-4 inline-block text-accent underline">{t("title")}</Link>
      </div>
    );
  }
  const { deck } = decoded;
  const get = (id: string | null) => (id ? pool.get(id) ?? null : null);
  const rows = (r: Record<string, number>) =>
    Object.entries(r)
      .map(([id, n]) => [pool.get(id), n] as const)
      .filter((x): x is readonly [PoolCard, number] => !!x[0])
      .sort(([a], [b]) => fullName(a).localeCompare(fullName(b)));
  const legend = get(deck.legend);
  const champion = get(deck.champion);
  const mainRows = rows(deck.main);
  const sum = (r: readonly (readonly [PoolCard, number])[]) => r.reduce((a, [, n]) => a + n, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 print:max-w-none print:p-0 print:text-black">
      <div className="mb-6 flex flex-wrap items-center gap-3 print:hidden">
        <PrintButton label={t("printNow")} />
        <Link href={{ pathname: "/builder", query: { code, ...(name ? { name } : {}) } }} className="text-sm text-accent underline">
          {t("backToBuilder")}
        </Link>
        <p className="w-full text-xs text-muted">{t("printHelp")}</p>
      </div>
      <div className="rounded-xl border border-border bg-surface p-6 print:rounded-none print:border-0 print:bg-white print:p-0">
        <h1 className="font-display text-2xl font-bold">{name || t("printTitle")}</h1>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          {["printPlayer", "printPlayerId", "printEvent", "printDate"].map((k) => (
            <div key={k}>
              <dt className="text-xs text-muted print:text-black">{t(k as "printPlayer")}</dt>
              <dd className="mt-4 border-b border-current" />
            </div>
          ))}
        </dl>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 print:grid-cols-2">
          <div className="space-y-5">
            <Block title={t("legend")} items={legend ? [[listName(legend), 1]] : []} />
            {deck.extraLegends.length > 0 && <Block title={t("extraLegendsTitle")} items={deck.extraLegends.map((id) => get(id)).filter(Boolean).map((c) => [listName(c!), 1] as const)} />}
            <Block title={t("champion")} items={champion ? [[fullName(champion), 1]] : []} />
            <Block title={t("battlefields")} items={deck.battlefields.map((id) => get(id)).filter(Boolean).map((c) => [fullName(c!), 1] as const)} total={deck.battlefields.length} />
            <Block title={t("runes")} items={rows(deck.runes).map(([c, n]) => [fullName(c), n] as const)} total={sum(rows(deck.runes))} />
            <Block title={t("side")} items={rows(deck.side).map(([c, n]) => [fullName(c), n] as const)} total={sum(rows(deck.side))} />
          </div>
          <div className="space-y-5">
            {(["Unit", "Spell", "Gear"] as const).map((type) => {
              const items = mainRows.filter(([c]) => c.type === type);
              return items.length ? <Block key={type} title={tt(type)} items={items.map(([c, n]) => [fullName(c), n] as const)} total={sum(items)} /> : null;
            })}
            <p className="text-sm font-bold">{t("printMainTotal", { count: mainCount(deck) })}</p>
          </div>
        </div>
        <p className="mt-6 font-mono text-[10px] break-all text-muted print:text-black">{code}</p>
      </div>
    </div>
  );
}
