import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

type Query = Record<string, string | undefined>;

export function Pagination({ pathname, query, page, total, pageSize }: { pathname: string; query: Query; page: number; total: number; pageSize: number }) {
  const t = useTranslations("Common");
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (p: number) => ({ pathname, query: Object.fromEntries(Object.entries({ ...query, page: String(p) }).filter(([, v]) => v)) as Record<string, string> });
  return (
    <nav className="mt-6 flex items-center justify-between gap-4 text-sm" aria-label={t("page", { page, total: pages })}>
      {page > 1 ? (
        <Link href={href(page - 1)} className="rounded-md border border-border px-3 py-1.5 hover:bg-surface">← {t("previous")}</Link>
      ) : (
        <span />
      )}
      <span className="text-muted">{t("page", { page, total: pages })}</span>
      {page < pages ? (
        <Link href={href(page + 1)} className="rounded-md border border-border px-3 py-1.5 hover:bg-surface">{t("next")} →</Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
