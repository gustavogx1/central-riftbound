import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ComingSoon } from "@/components/ComingSoon";

export async function generateMetadata({ params }: PageProps<"/[locale]/builder">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Nav" });
  return { title: t("builder") };
}

export default async function Page({ params }: PageProps<"/[locale]/builder">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Nav");
  return <ComingSoon section={t("builder")} phase={3} />;
}
