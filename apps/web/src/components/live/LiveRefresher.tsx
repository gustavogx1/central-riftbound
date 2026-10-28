"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

const POLL_MS = 20_000;

/**
 * Consulta o pulso do evento e recarrega a página (só os dados do servidor,
 * sem perder a rolagem nem o que foi digitado) quando a versão sobe.
 */
export function LiveRefresher({ eventId, version, changedAt }: { eventId: number; version: number; changedAt: string | null }) {
  const t = useTranslations("Live");
  const format = useFormatter();
  const router = useRouter();
  const known = useRef(version);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    known.current = Math.max(known.current, version);
  }, [version]);

  useEffect(() => {
    let stopped = false;
    async function poll() {
      if (document.hidden) return;
      setChecking(true);
      try {
        const res = await fetch(`/api/events/${eventId}/pulse`);
        const pulse = (await res.json()) as { live: boolean; version: number };
        if (!stopped && (pulse.version > known.current || !pulse.live)) {
          known.current = pulse.version;
          router.refresh();
        }
      } catch {
        // Sem rede: tenta de novo no próximo ciclo.
      } finally {
        if (!stopped) setChecking(false);
      }
    }
    const id = setInterval(poll, POLL_MS);
    const onVisible = () => !document.hidden && poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [eventId, router]);

  return (
    <p className="flex items-center gap-2 text-xs text-muted" aria-live="polite">
      <span className={`size-2 rounded-full bg-live ${checking ? "opacity-60" : "animate-pulse motion-reduce:animate-none"}`} aria-hidden />
      <span className="font-semibold uppercase tracking-wide text-live">{t("badge")}</span>
      {changedAt && <span>{t("updated", { time: format.dateTime(new Date(changedAt), { timeStyle: "medium" }) })}</span>}
    </p>
  );
}
