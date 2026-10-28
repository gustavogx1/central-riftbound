"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { LegendAvatar } from "@/components/LegendAvatar";
import { Link } from "@/i18n/navigation";
import type { MyMatchRow } from "@/lib/queries";

type LegendLite = { champion: string; cardId: string; domains: string[] };
const STORAGE_KEY = "cr:me";

function read(): number | null {
  try {
    return Number(localStorage.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}
function write(id: number | null) {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, String(id));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Navegação privada: só não lembra.
  }
}

/** "Achar minha mesa": busca o nome, mostra mesa, adversário e posição; lembra no aparelho. */
export function MyMatch({ rows, legends, round }: { rows: MyMatchRow[]; legends: Record<string, LegendLite>; round: string }) {
  const t = useTranslations("Live");
  const [q, setQ] = useState("");
  const stored = useSyncExternalStore(subscribe, read, () => null);
  // undefined = ainda não escolheu nesta visita; usa o que ficou guardado.
  const [picked, setPicked] = useState<number | null | undefined>(undefined);
  const me = picked === undefined ? stored : picked;

  const mine = me ? rows.find((r) => r.playerId === me) : undefined;
  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    return rows.filter((r) => r.name.toLowerCase().includes(needle)).slice(0, 8);
  }, [q, rows]);

  const pick = (id: number | null) => {
    setPicked(id);
    write(id);
    setQ("");
  };

  const legend = (slug: string | null) => {
    const l = slug ? legends[slug] : undefined;
    return l ? (
      <span className="flex items-center gap-1.5 text-xs text-muted">
        <LegendAvatar cardId={l.cardId} champion={l.champion} domains={l.domains} size={20} />
        {l.champion}
      </span>
    ) : null;
  };

  return (
    <section className="rounded-xl border border-accent/40 bg-surface p-4" aria-labelledby="my-match">
      <h2 id="my-match" className="font-display text-lg font-semibold">{t("findMe")}</h2>
      {mine ? (
        <div className="mt-3">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:flex sm:flex-wrap sm:items-center">
            <div>
              <span className="block text-xs text-muted">{round}</span>
              <span className="font-display text-3xl font-bold tabular-nums">
                {mine.isBye ? t("bye") : t("tableN", { n: mine.table ?? "—" })}
              </span>
            </div>
            <div className="col-span-2 min-w-0 sm:flex-1">
              <Link href={`/players/${mine.playerId}`} className="block truncate font-semibold hover:text-accent">{mine.name}</Link>
              {legend(mine.legend)}
            </div>
            {!mine.isBye && (
              <div className="col-span-2 min-w-0 sm:flex-1">
                <span className="block text-xs text-muted">{t("opponent")}</span>
                {mine.opponentId && mine.opponent ? (
                  <Link href={`/players/${mine.opponentId}`} className="block truncate font-semibold hover:text-accent">{mine.opponent}</Link>
                ) : (
                  <span className="block font-semibold">—</span>
                )}
                {legend(mine.opponentLegend)}
              </div>
            )}
            <div className="sm:text-right">
              <span className="block text-xs text-muted">{t("result")}</span>
              <span className={`font-semibold ${mine.result === "win" ? "text-good" : mine.result === "loss" ? "text-bad" : ""}`}>
                {mine.result ? `${t(mine.result)}${mine.games ? ` ${mine.games}` : ""}` : t("playing")}
              </span>
            </div>
            {mine.rank !== null && (
              <div className="text-right">
                <span className="block text-xs text-muted">{t("standing")}</span>
                <span className="font-semibold tabular-nums">#{mine.rank} · {mine.record}</span>
              </div>
            )}
          </div>
          <button type="button" onClick={() => pick(null)} className="mt-3 text-xs text-muted underline hover:text-text">{t("notMe")}</button>
        </div>
      ) : (
        <div className="mt-3">
          {me && <p className="mb-2 text-sm text-muted">{t("notInRound")}</p>}
          <label className="block text-sm">
            <span className="text-muted">{t("findMeHint")}</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("yourName")}
              className="mt-1 w-full max-w-sm rounded-md border border-border bg-bg px-3 py-2"
              autoComplete="off"
            />
          </label>
          {matches.length > 0 && (
            <ul className="mt-2 max-w-sm divide-y divide-border rounded-md border border-border">
              {matches.map((r) => (
                <li key={r.playerId}>
                  <button type="button" onClick={() => pick(r.playerId)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-surface-2">
                    <span className="truncate">{r.name}</span>
                    <span className="shrink-0 text-xs text-muted">{r.isBye ? t("bye") : t("tableN", { n: r.table ?? "—" })}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {q.trim().length >= 2 && matches.length === 0 && <p className="mt-2 text-sm text-muted">{t("noOne")}</p>}
        </div>
      )}
    </section>
  );
}
