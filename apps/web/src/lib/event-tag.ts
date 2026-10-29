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
