import { getTranslations } from "next-intl/server";

/** "Tempero" da lista (0–100) comparado às listas de torneio da mesma lenda. */
export async function SpiceBadge({ value, compared }: { value: number; compared: number }) {
  const t = await getTranslations("CardStats");
  const level = value >= 30 ? "high" : value >= 12 ? "mid" : "low";
  const color = level === "high" ? "bg-bad/15 text-bad" : level === "mid" ? "bg-accent/15 text-accent" : "bg-surface-2 text-muted";
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs ${color}`} title={t("spiceHint", { count: compared })}>
      {t("spice", { value, level })}
    </span>
  );
}
