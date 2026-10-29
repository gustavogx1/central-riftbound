import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegalPage } from "@/components/LegalPage";

const KEYS = ["intro", "signIn", "stored", "public", "players", "cookies", "services", "delete"] as const;

export async function generateMetadata({ params }: PageProps<"/[locale]/about/privacy">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Privacy" });
  return { title: t("title") };
}

export default async function PrivacyPage({ params }: PageProps<"/[locale]/about/privacy">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPage namespace="Privacy" keys={KEYS} />;
}
