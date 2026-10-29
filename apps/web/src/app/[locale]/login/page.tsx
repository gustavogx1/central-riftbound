import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { signIn } from "@/lib/auth/actions";
import { authEnabled, enabledProviders } from "@/lib/auth/config";
import { safeNext } from "@/lib/auth/next";

export async function generateMetadata({ params }: PageProps<"/[locale]/login">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Account" });
  return { title: t("signIn"), robots: { index: false } };
}

const LABEL = { discord: "Discord", google: "Google" } as const;

export default async function LoginPage({ params, searchParams }: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("Account");
  const raw = typeof sp.next === "string" ? sp.next : "/";
  // `next` chega sem o idioma (ex.: /builder); o retorno do login precisa do caminho completo.
  const next = safeNext(getPathname({ href: safeNext(raw), locale: locale as Locale }));
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-3xl font-bold">{t("signIn")}</h1>
      <p className="mt-3 text-muted">{t("signInLead")}</p>
      {sp.login === "error" && <p role="alert" className="mt-4 rounded-md bg-bad/15 px-3 py-2 text-sm text-bad">{t("signInError")}</p>}
      {authEnabled && enabledProviders.length ? (
        <div className="mt-6 space-y-3">
          {enabledProviders.map((p) => (
            <form key={p} action={signIn}>
              <input type="hidden" name="provider" value={p} />
              <input type="hidden" name="next" value={next} />
              <button className="w-full rounded-md bg-accent px-4 py-2.5 font-semibold text-accent-ink hover:opacity-90">{t("continueWith", { provider: LABEL[p] })}</button>
            </form>
          ))}
        </div>
      ) : (
        <p className="mt-6 rounded-md border border-border bg-surface p-4 text-sm text-muted">{t("disabled")}</p>
      )}
      <p className="mt-6 text-xs text-muted">{t("privacy")}</p>
    </div>
  );
}
