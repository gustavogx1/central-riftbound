import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DeckBuilder } from "@/components/builder/DeckBuilder";
import { getCardPool } from "@/lib/queries";

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<"/[locale]/builder">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Builder" });
  return { title: t("title"), description: t("lead") };
}

export default async function BuilderPage({ params }: PageProps<"/[locale]/builder">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Builder");
  const cards = await getCardPool();
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
      <p className="mt-2 max-w-3xl text-muted">{t("lead")}</p>
      <div className="mt-6">
        <DeckBuilder cards={cards} />
      </div>
    </div>
  );
}
