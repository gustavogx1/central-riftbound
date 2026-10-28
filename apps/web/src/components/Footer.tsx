import { useTranslations } from "next-intl";

export function Footer() {
  const t = useTranslations("Footer");
  return (
    <footer className="mt-24 border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted">
        <p className="max-w-3xl">{t("disclaimer")}</p>
      </div>
    </footer>
  );
}
