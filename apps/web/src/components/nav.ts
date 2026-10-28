export const SECTIONS = [
  { key: "meta", href: "/meta", phase: 1 },
  { key: "events", href: "/events", phase: 1 },
  { key: "legends", href: "/legends", phase: 1 },
  { key: "decks", href: "/decks", phase: 3 },
  { key: "cards", href: "/cards", phase: 1 },
  { key: "builder", href: "/builder", phase: 3 },
] as const;

export type SectionKey = (typeof SECTIONS)[number]["key"];
