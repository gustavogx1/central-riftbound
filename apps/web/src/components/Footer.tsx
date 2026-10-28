import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function Footer() {
  const t = useTranslations("Footer");
  return (
    <footer className="mt-24 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted md:flex-row md:items-start md:justify-between">
        <p className="max-w-3xl">{t("disclaimer")}</p>
        <Link href="/about/methodology" className="shrink-0 hover:text-text">{t("methodology")}</Link>
      </div>
    </footer>
  );
}
