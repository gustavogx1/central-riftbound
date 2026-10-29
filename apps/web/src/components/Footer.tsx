import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function Footer() {
  const t = useTranslations("Footer");
  return (
    <footer className="mt-24 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted md:flex-row md:items-start md:justify-between">
        <p className="max-w-3xl">{t("disclaimer")}</p>
        <nav className="flex shrink-0 gap-4">
          <Link href="/about/methodology" className="hover:text-text">{t("methodology")}</Link>
          <Link href="/about/privacy" className="hover:text-text">{t("privacy")}</Link>
          <Link href="/about/terms" className="hover:text-text">{t("terms")}</Link>
        </nav>
      </div>
    </footer>
  );
}
