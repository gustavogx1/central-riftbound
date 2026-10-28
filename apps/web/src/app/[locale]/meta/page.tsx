import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ComingSoon } from "@/components/ComingSoon";

export async function generateMetadata({ params }: PageProps<"/[locale]/meta">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Nav" });
  return { title: t("meta") };
}

export default async function Page({ params }: PageProps<"/[locale]/meta">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Nav");
  return <ComingSoon section={t("meta")} phase={1} />;
}
