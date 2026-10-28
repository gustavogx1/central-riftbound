import { useTranslations } from "next-intl";

export function Trend({ power, prev }: { power: number; prev: number | null }) {
  const t = useTranslations("Common");
  if (prev === null) return <span className="text-muted">—</span>;
  const d = power - prev;
  if (d === 0) return <span className="text-muted" title={t("trendFlat")}>=</span>;
  return d > 0 ? (
    <span className="font-semibold text-[var(--tier-c)]" title={t("trendUp", { value: d })}>▲ {d}</span>
  ) : (
    <span className="font-semibold text-[var(--tier-s)]" title={t("trendDown", { value: -d })}>▼ {-d}</span>
  );
}
