import type { Metadata } from "next";
import { CARD_TYPES, DOMAINS, matchCard, parseCardQuery } from "@cr/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DomainDots } from "@/components/DomainDots";
import { Pagination } from "@/components/Pagination";
import { RulesText } from "@/components/RulesText";
import { makeFormat } from "@/lib/format";
import { cardImage } from "@/lib/images";
import { COLORLESS, PRINT_VERSIONS, getCardPool, getSets, searchCards, type PrintVersion } from "@/lib/queries";

export const revalidate = 3600;
const PAGE_SIZE = 36;

export async function generateMetadata({ params }: PageProps<"/[locale]/cards">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Cards" });
  return { title: t("title"), description: t("lead") };
}

/** Converte o `variant` da galeria ("alt art", "overnumbered", "signed", "special") na chave de tradução. */
function variantKey(v: string): PrintVersion {
  if (v === "alt art") return "altArt";
  return (PRINT_VERSIONS as readonly string[]).includes(v) ? (v as PrintVersion) : "special";
}

const str = (v: string | string[] | undefined, max = 80) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);

export default async function CardsPage({ params, searchParams }: PageProps<"/[locale]/cards">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("Cards");
  const tt = await getTranslations("Types");
  const td = await getTranslations("Domains");
  const ts = await getTranslations("Sets");
  const tc = await getTranslations("Common");
  const tv = await getTranslations("PrintVersions");
  const f = makeFormat(locale);

  const q = str(sp.q, 200);
  const type = (CARD_TYPES as readonly string[]).includes(str(sp.type) ?? "") ? str(sp.type) : undefined;
  const domainOptions = [...DOMAINS, COLORLESS] as const;
  const domain = (domainOptions as readonly string[]).includes(str(sp.domain) ?? "") ? str(sp.domain) : undefined;
  const sets = await getSets();
  const set = sets.some((s) => s.id === str(sp.set)) ? str(sp.set) : undefined;
  const version = (PRINT_VERSIONS as readonly string[]).includes(str(sp.version) ?? "") ? (str(sp.version) as PrintVersion) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  // A busca com sintaxe roda sobre as cartas base; os outros filtros e a listagem por impressão ficam no banco.
  const parsed = parseCardQuery(q ?? "");
  const cardIds = parsed.groups.length ? (await getCardPool()).filter((c) => matchCard(c, parsed)).map((c) => c.id) : undefined;
  const { rows, total } = await searchCards({ q, type, domain, set, version, cardIds, page, pageSize: PAGE_SIZE });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold md:text-4xl">{t("title")}</h1>
      <p className="mt-3 text-muted">{t("lead")}</p>

      <form method="get" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]">
        <label className="text-sm">
          <span className="sr-only">{tc("search")}</span>
          <input name="q" defaultValue={q} placeholder={t("placeholder")} className="w-full rounded-md border border-border bg-surface px-3 py-2" />
        </label>
        {[
          ["type", t("type"), CARD_TYPES.map((v) => [v, tt(v)]), type],
          ["domain", t("domain"), domainOptions.map((v) => [v, td(v)]), domain],
          ["set", tc("set"), sets.map((s) => [s.id, ts(s.id as "all")]), set],
          ["version", t("version"), PRINT_VERSIONS.map((v) => [v, tv(v)]), version],
        ].map(([name, label, options, value]) => (
          <label key={name as string} className="text-sm">
            <span className="sr-only">{label as string}</span>
            <select name={name as string} defaultValue={(value as string) ?? ""} className="w-full rounded-md border border-border bg-surface px-2 py-2">
              <option value="">{label as string}: {t("any")}</option>
              {(options as string[][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </label>
        ))}
        <button className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">{tc("search")}</button>
      </form>

      <p className="mt-2 text-sm text-muted">
        {t.rich("syntaxHint", { link: (chunks) => <Link href="/cards/syntax" className="text-accent underline">{chunks}</Link> })}
      </p>
      {parsed.errors.length > 0 && (
        <p role="status" className="mt-2 text-sm text-bad">{t("syntaxErrors", { terms: parsed.errors.join(" ") })}</p>
      )}
      <p className="mt-4 text-sm text-muted">{t("results", { count: total })}</p>

      {rows.length === 0 ? (
        <p className="mt-8 rounded-xl border border-border bg-surface p-6 text-muted">{total === 0 && !q && !type && !domain && !set && !version ? tc("noData") : t("noResults")}</p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map(({ card, print }) => {
            const img = cardImage(print.id);
            return (
              <li key={print.id} className="overflow-hidden rounded-xl border border-border bg-surface hover:border-accent">
                <Link href={`/cards/${print.code}`} className="block">
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt={`${card.name}${card.rulesText ? `: ${card.rulesText}` : ""}`} width={372} height={519} loading="lazy" className="w-full" />
                ) : (
                  <div className="p-3">
                    <p className="flex items-start justify-between gap-2">
                      <span className="font-semibold">{card.name}</span>
                      {card.energyCost !== null && <span className="grid size-6 shrink-0 place-items-center rounded-full bg-text text-xs font-bold text-bg">{card.energyCost}</span>}
                    </p>
                    <p className="mt-1 flex items-center gap-2 text-xs text-muted">
                      <DomainDots domains={card.domains} />
                      {card.type ? tt(card.type) : "—"}
                      {card.might !== null && <> · {card.might} {t("might")}</>}
                    </p>
                    {card.rulesText && <p className="mt-2 text-xs leading-relaxed"><RulesText text={card.rulesText} /></p>}
                  </div>
                )}
                <p className="border-t border-border px-3 py-1.5 text-[11px] text-muted">
                  {print.publicCode} · {f.num(print.collectorNumber)}
                  {print.variant && <> · {print.variant.split(",").map((v) => tv(variantKey(v.trim()))).join(", ")}</>}
                </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination pathname="/cards" query={{ q, type, domain, set, version }} page={page} total={total} pageSize={PAGE_SIZE} />
    </div>
  );
}
