/**
 * Etiqueta do tipo do evento. O Regional Championship fica no banco como "main"
 * (conta nas estatísticas junto com os Regional Qualifiers), mas ganha a própria
 * etiqueta pelo nome.
 */
export type EventTag = "main" | "championship" | "side" | "community" | "showdown";

export function eventTag(kind: string, name: string): EventTag {
  if (kind === "main" && /regional championship/i.test(name)) return "championship";
  return kind as EventTag;
}

export type EventStatusKey = "statusUpcoming" | "statusInProgress" | "statusComplete";

/** `display_status` da UVS ("upcoming", "inProgress", "complete") → chave de tradução. */
export function eventStatusKey(status: string): EventStatusKey | null {
  if (status === "complete") return "statusComplete";
  if (status === "inProgress") return "statusInProgress";
  if (status === "upcoming") return "statusUpcoming";
  return null;
}

/** Data e hora no fuso do local do evento ("sáb., 31 de out. de 2026 · 09:30 EDT"). */
export function venueDateTime(locale: string, startsAt: Date, timezone: string): string | null {
  try {
    const date = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: timezone }).format(startsAt);
    const time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: timezone }).format(startsAt);
    // Sigla do fuso em inglês ("EDT", "CET"): em pt-BR o Intl só dá "GMT-4".
    const zone = new Intl.DateTimeFormat("en-US", { timeZoneName: "short", timeZone: timezone }).formatToParts(startsAt).find((p) => p.type === "timeZoneName")?.value;
    return `${date} · ${time}${zone ? ` ${zone}` : ""}`;
  } catch {
    return null;
  }
}
