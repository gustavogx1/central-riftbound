import type { Metadata } from "next";
import { MIN_ENTRIES } from "@cr/core";
import { getTranslations, setRequestLocale } from "next-intl/server";

export async function generateMetadata({ params }: PageProps<"/[locale]/about/methodology">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Methodology" });
  return { title: t("title") };
}

export default async function MethodologyPage({ params }: PageProps<"/[locale]/about/methodology">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Methodology");
  const keys = ["winRate", "adjusted", "conversion", "power", "pilots", "minimum", "source"] as const;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
      <div className="mt-6 space-y-4 leading-relaxed text-muted">
        {keys.map((k) => (
          <p key={k}>{t(k, { min: MIN_ENTRIES })}</p>
        ))}
      </div>
    </div>
  );
}
