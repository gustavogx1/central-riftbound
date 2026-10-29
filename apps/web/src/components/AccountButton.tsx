"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useMe } from "@/lib/auth/use-me";

/** Entrar / Minha conta. Some quando o login não está configurado. */
export function AccountButton() {
  const t = useTranslations("Account");
  const me = useMe();
  const pathname = usePathname();
  if (!me?.enabled) return null;
  if (!me.user) {
    return (
      <Link href={{ pathname: "/login", query: { next: pathname } }} className="rounded-md border border-border px-3 py-1 text-sm hover:border-accent">
        {t("signIn")}
      </Link>
    );
  }
  return (
    <Link href="/account" className="max-w-32 truncate rounded-md border border-border px-3 py-1 text-sm hover:border-accent" title={t("myAccount")}>
      {me.user.name}
    </Link>
  );
}
