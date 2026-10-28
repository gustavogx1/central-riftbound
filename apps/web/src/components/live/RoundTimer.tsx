"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/** Relógio da rodada como o organizador mostra (pausa e fim vêm da UVS). */
export function RoundTimer({ endsAt, pausedAt, running }: { endsAt: string | null; pausedAt: string | null; running: boolean }) {
  const t = useTranslations("Live");
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // Só no navegador: o servidor não sabe a hora de quem está olhando.
    const first = setTimeout(() => setNow(Date.now()), 0);
    const id = running ? setInterval(() => setNow(Date.now()), 1000) : undefined;
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [running]);

  if (!endsAt || now === null) return null;
  const ref = running || !pausedAt ? now : new Date(pausedAt).getTime();
  const left = Math.max(0, Math.round((new Date(endsAt).getTime() - ref) / 1000));
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-2 text-center">
      <span className="block text-xs text-muted">{left === 0 ? t("timeUp") : running ? t("timeLeft") : t("paused")}</span>
      <span className="font-display text-2xl font-bold tabular-nums" role="timer">{mm}:{ss}</span>
    </div>
  );
}
