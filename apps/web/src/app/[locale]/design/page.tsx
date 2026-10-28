import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DesignPreview } from "@/components/DesignPreview";

export async function generateMetadata({ params }: PageProps<"/[locale]/design">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Design" });
  return { title: t("title"), robots: { index: false } };
}

export default async function DesignPage({ params }: PageProps<"/[locale]/design">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Design");
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
      <p className="mt-3 max-w-2xl text-muted">{t("lead")}</p>
      <div className="mt-10">
        <DesignPreview />
      </div>
    </div>
  );
}
