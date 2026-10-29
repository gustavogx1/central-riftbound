import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegalPage } from "@/components/LegalPage";

const KEYS = ["intro", "free", "conduct", "content", "riot", "changes"] as const;

export async function generateMetadata({ params }: PageProps<"/[locale]/about/terms">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Terms" });
  return { title: t("title") };
}

export default async function TermsPage({ params }: PageProps<"/[locale]/about/terms">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPage namespace="Terms" keys={KEYS} />;
}
