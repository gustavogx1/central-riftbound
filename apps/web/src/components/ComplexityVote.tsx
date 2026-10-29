"use client";

import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useMe } from "@/lib/auth/use-me";
import { voteAction } from "@/lib/deck-actions";

const VALUES = [1, 2, 3, 4, 5] as const;

/** Voto 1–5 na complexidade da lenda, no set mostrado. Média e total vêm do servidor. */
export function ComplexityVote({ legend, metagame, votes, average, min }: { legend: string; metagame: string; votes: number; average: number | null; min: number }) {
  const t = useTranslations("Complexity");
  const locale = useLocale();
  const me = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const [mine, setMine] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const loggedIn = !!me?.user;

  useEffect(() => {
    if (!loggedIn) return;
    let alive = true;
    fetch(`/api/votes?legend=${encodeURIComponent(legend)}&metagame=${encodeURIComponent(metagame)}`, { cache: "no-store" })
      .then((r) => r.json() as Promise<{ mine: number | null }>)
      .then((d) => alive && setMine(d.mine))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [loggedIn, legend, metagame]);

  const vote = (value: number | null) =>
    start(async () => {
      const res = await voteAction({ legend, metagame, value });
      if (res.ok) {
        setMine(value);
        router.refresh();
      }
    });

  const avg = average === null ? null : new Intl.NumberFormat(locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(average);
  return (
    <div className="mt-4 max-w-2xl rounded-lg border border-border bg-surface p-3 text-sm">
      <p className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold">{t("title", { set: metagame })}</span>
        <span className="text-xs text-muted">{votes ? t("summary", { average: avg ?? "—", count: votes }) : t("noVotes")}</span>
      </p>
      {votes > 0 && votes < min && <p className="mt-1 text-xs text-muted">{t("needMore", { min })}</p>}
      {me?.enabled &&
        (loggedIn ? (
          <div className="mt-2 flex flex-wrap items-center gap-1" role="group" aria-label={t("yourVote")}>
            <span className="mr-1 text-xs text-muted">{t("yourVote")}</span>
            {VALUES.map((v) => (
              <button
                key={v}
                disabled={pending}
                aria-pressed={mine === v}
                onClick={() => vote(mine === v ? null : v)}
                title={t(`scale.${v}`)}
                className={`size-8 rounded-md border text-sm font-semibold disabled:opacity-50 ${mine === v ? "border-accent bg-accent text-accent-ink" : "border-border hover:border-accent"}`}
              >
                {v}
              </button>
            ))}
            <span className="ml-2 text-xs text-muted">{t("scaleHint")}</span>
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted">
            {t.rich("login", { link: (c) => <Link href={{ pathname: "/login", query: { next: pathname } }} className="text-accent underline">{c}</Link> })}
          </p>
        ))}
    </div>
  );
}
