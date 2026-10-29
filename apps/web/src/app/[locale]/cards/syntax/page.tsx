import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({ params }: PageProps<"/[locale]/cards/syntax">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Syntax" });
  return { title: t("title"), description: t("lead") };
}

/** Exemplos da busca: o texto do exemplo é sintaxe (igual nos dois idiomas), a explicação vem das mensagens. */
const ROWS = [
  ["any", "jinx"],
  ["name", "n:volibear"],
  ["text", 'o:"draw a card"'],
  ["type", "t:unit"],
  ["supertype", "t:champion"],
  ["domain", "d:fury"],
  ["domains", "d:fury+mind"],
  ["neutral", "d:none"],
  ["identity", "id:calm+body"],
  ["cost", "c<=2"],
  ["power", "p>=1"],
  ["might", "m=5"],
  ["tag", "tag:noxus"],
  ["set", "set:OGN"],
  ["rarity", "r:rare"],
  ["is", "is:signature"],
  ["unique", "is:unique"],
  ["banned", "is:banned"],
  ["negate", "-t:spell"],
  ["or", "tag:zaun or tag:piltover"],
] as const;

export default async function SyntaxPage({ params }: PageProps<"/[locale]/cards/syntax">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Syntax");
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
      <p className="mt-3 text-muted">{t("lead")}</p>
      <div className="mt-6 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">{t("example")}</th>
              <th className="px-3 py-2 font-medium">{t("meaning")}</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([key, example]) => (
              <tr key={key} className="border-t border-border">
                <td className="px-3 py-2 whitespace-nowrap">
                  <Link href={{ pathname: "/cards", query: { q: example } }} className="font-mono text-accent hover:underline">
                    {example}
                  </Link>
                </td>
                <td className="px-3 py-2 text-muted">{t(`rows.${key}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-6 text-sm text-muted">{t("aliases")}</p>
    </div>
  );
}
