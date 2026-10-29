import { getTranslations } from "next-intl/server";
import { CONTACT } from "@/lib/contact";

/** Página de texto corrido (privacidade, termos): título, data e um parágrafo por chave. */
export async function LegalPage({ namespace, keys }: { namespace: "Privacy" | "Terms"; keys: readonly string[] }) {
  const t = await getTranslations(namespace);
  // Chaves vêm da página; só algumas usam {contact}, então a checagem de tipo por chave não serve aqui.
  const text = t as unknown as (key: string, values: Record<string, string>) => string;
  const tl = await getTranslations("Legal");
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
      <p className="mt-2 text-sm text-muted">{tl("updated")}</p>
      <div className="mt-6 space-y-4 leading-relaxed text-muted">
        {keys.map((k) => (
          <p key={k}>{text(k, { contact: CONTACT })}</p>
        ))}
      </div>
    </div>
  );
}
