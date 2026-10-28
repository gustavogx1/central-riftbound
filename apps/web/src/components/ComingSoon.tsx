import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function ComingSoon({ section, phase }: { section: string; phase: number }) {
  const t = useTranslations("ComingSoon");
  return (
    <section className="mx-auto max-w-3xl px-4 py-24 text-center">
      <h1 className="font-display text-3xl font-semibold">{t("title", { section })}</h1>
      <p className="mt-3 text-muted">{t("body", { phase })}</p>
      <Link href="/" className="mt-8 inline-block rounded-md border border-border px-4 py-2 hover:bg-surface">
        {t("back")}
      </Link>
    </section>
  );
}
