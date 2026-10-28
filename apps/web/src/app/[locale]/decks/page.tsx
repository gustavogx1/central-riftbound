import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ComingSoon } from "@/components/ComingSoon";

export async function generateMetadata({ params }: PageProps<"/[locale]/decks">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Nav" });
  return { title: t("decks") };
}

export default async function Page({ params }: PageProps<"/[locale]/decks">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Nav");
  return <ComingSoon section={t("decks")} phase={3} />;
}
