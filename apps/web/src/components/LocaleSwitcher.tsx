"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

const SHORT = { en: "shortEn", "pt-BR": "shortPtBR" } as const;

/**
 * No celular mostra só a sigla (o nome inteiro empurrava o cabeçalho para fora da tela);
 * o select fica invisível por cima dela, então o toque abre a lista nativa.
 */
export function LocaleSwitcher() {
  const t = useTranslations("Locale");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  return (
    <label className="relative flex items-center gap-2 text-sm text-muted">
      <span className="sr-only">{t("label")}</span>
      <span aria-hidden className="rounded-md border border-border bg-surface px-2 py-1 whitespace-nowrap text-text sm:hidden">
        {t(SHORT[locale])} ▾
      </span>
      <select
        className="absolute inset-0 opacity-0 sm:static sm:rounded-md sm:border sm:border-border sm:bg-surface sm:px-2 sm:py-1 sm:text-text sm:opacity-100"
        value={locale}
        // Mantém os filtros da página (?view=, ?set=...) ao trocar de idioma.
        onChange={(e) => router.replace(`${pathname}${window.location.search}`, { locale: e.target.value as Locale })}
      >
        {routing.locales.map((l) => (
          <option key={l} value={l}>
            {t(l)}
          </option>
        ))}
      </select>
    </label>
  );
}
