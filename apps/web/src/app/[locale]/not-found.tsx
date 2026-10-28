import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("NotFound");
  return (
    <section className="mx-auto max-w-3xl px-4 py-24 text-center">
      <h1 className="font-display text-3xl font-semibold">{t("title")}</h1>
      <Link href="/" className="mt-8 inline-block rounded-md border border-border px-4 py-2 hover:bg-surface">
        {t("back")}
      </Link>
    </section>
  );
}
