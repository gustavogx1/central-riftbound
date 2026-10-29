import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const KIND_LABEL = { main: "mainOnly", showdown: "showdownOnly", all: "allEvents" } as const;

/** Filtros de set e tipo de evento como links (todo filtro vira URL compartilhável). */
export function ScopeFilter({ pathname, metagames, meta, kind, extra = {} }: { pathname: string; metagames: string[]; meta: string; kind: string; extra?: Record<string, string> }) {
  const t = useTranslations("Common");
  const ts = useTranslations("Sets");
  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm transition ${active ? "border-accent bg-surface-2 text-text" : "border-border text-muted hover:bg-surface hover:text-text"}`;
  const href = (m: string, k: string) => ({ pathname, query: { ...extra, set: m, kind: k } });
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("set")}>
        {[...metagames, "all"].map((m) => (
          <Link key={m} href={href(m, kind)} className={pill(m === meta)} aria-current={m === meta ? "true" : undefined}>
            {ts(m as "all")}
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("events")}>
        {(["main", "showdown", "all"] as const).map((k) => (
          <Link key={k} href={href(meta, k)} className={pill(k === kind)} aria-current={k === kind ? "true" : undefined}>
            {t(KIND_LABEL[k])}
          </Link>
        ))}
      </div>
    </div>
  );
}
