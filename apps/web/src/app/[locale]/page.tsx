import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import summary from "@/generated/catalog-summary.json";
import { Link } from "@/i18n/navigation";

const FEATURES = ["Meta", "Live", "Legends", "Tools"] as const;

export default function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("Home");

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 md:pt-24">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-accent-2">{t("eyebrow")}</p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold leading-tight md:text-6xl">{t("title")}</h1>
        <p className="mt-6 max-w-2xl text-lg text-muted">{t("lead")}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/meta" className="rounded-md bg-accent px-5 py-2.5 font-semibold text-accent-ink hover:opacity-90">
            {t("ctaMeta")}
          </Link>
          <Link href="/cards" className="rounded-md border border-border px-5 py-2.5 font-semibold hover:bg-surface">
            {t("ctaCards")}
          </Link>
        </div>
        {summary.cards > 0 && (
          <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted">
            <li>{t("statsCards", { count: summary.cards })}</li>
            <li>{t("statsLegends", { count: summary.legends })}</li>
            <li>{t("statsSets", { count: summary.sets })}</li>
          </ul>
        )}
      </section>

      <section className="mx-auto max-w-6xl px-4" aria-labelledby="features">
        <h2 id="features" className="font-display text-2xl font-semibold">{t("featuresTitle")}</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <li key={f} className="rounded-xl border border-border bg-surface p-5">
              <h3 className="font-display text-lg font-semibold">{t(`feature${f}Title`)}</h3>
              <p className="mt-2 text-sm text-muted">{t(`feature${f}Body`)}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
