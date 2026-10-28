import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { Logo } from "./Logo";
import { SECTIONS } from "./nav";

export function Header() {
  const t = useTranslations("Nav");
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        {t("skipToContent")}
      </a>
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-display text-lg font-semibold tracking-wide">
          <Logo className="size-8" />
          <span>Central Riftbound</span>
        </Link>
        <nav aria-label={t("menu")} className="ml-auto hidden md:block">
          <ul className="flex items-center gap-1 text-sm">
            {SECTIONS.map((s) => (
              <li key={s.key}>
                <Link href={s.href} className="rounded-md px-3 py-2 text-muted transition hover:bg-surface hover:text-text">
                  {t(s.key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto md:ml-2">
          <LocaleSwitcher />
        </div>
      </div>
      <nav aria-label={t("menu")} className="border-t border-border md:hidden">
        <ul className="flex gap-1 overflow-x-auto px-4 py-2 text-sm">
          {SECTIONS.map((s) => (
            <li key={s.key} className="shrink-0">
              <Link href={s.href} className="block rounded-md px-3 py-1.5 text-muted hover:bg-surface hover:text-text">
                {t(s.key)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
