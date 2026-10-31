"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

/**
 * Horário do evento no fuso de quem está olhando e a hora atual no local do evento.
 * Só no navegador: o servidor não sabe o fuso do visitante.
 */
export function EventClock({ startsAt, timezone, showNow }: { startsAt: string; timezone: string; showNow: boolean }) {
  const t = useTranslations("Event");
  const locale = useLocale();
  const [now, setNow] = useState<number | null>(null);
  const [userTz, setUserTz] = useState<string | null>(null);

  useEffect(() => {
    const first = setTimeout(() => {
      setUserTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
      setNow(Date.now());
    }, 0);
    const id = showNow ? setInterval(() => setNow(Date.now()), 30_000) : undefined;
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [showNow]);

  if (now === null || !userTz) return null;
  const start = new Date(startsAt);
  const sameZone = offsetAt(start, userTz) === offsetAt(start, timezone);
  const time = (d: Date | number, tz: string, withDate: boolean) =>
    new Intl.DateTimeFormat(locale, { ...(withDate ? { month: "short", day: "numeric" } : {}), hour: "numeric", minute: "2-digit", timeZone: tz }).format(d);

  return (
    <>
      {!sameZone && <span className="block">{t("yourTime", { time: time(start, userTz, true) })}</span>}
      {showNow && <span className="block">{t("venueNow", { time: time(now, timezone, false) })}</span>}
    </>
  );
}

function offsetAt(d: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" }).formatToParts(d).find((p) => p.type === "timeZoneName")?.value ?? tz;
  } catch {
    return tz;
  }
}
