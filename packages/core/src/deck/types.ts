import type { CardType, Domain } from "../cards/types";

/** Carta como o deckbuilder precisa: dados de regra + códigos das impressões. */
export interface PoolCard {
  id: string;
  /** Código da impressão base (ex.: OGN-007), usado nos códigos de deck. */
  code: string;
  /** Todos os códigos de impressão da carta (variantes incluídas), para ler códigos de outros sites. */
  codes: string[];
  name: string;
  subtitle: string | null;
  type: CardType | null;
  supertypes: string[];
  tags: string[];
  domains: Domain[];
  energyCost: number | null;
  powerCost: number | null;
  might: number | null;
  rulesText: string;
  setId: string;
  number: number;
  rarity: string | null;
}

/**
 * Um deck. O campeão escolhido conta 1 cópia por si e fica fora de `main`;
 * `main` guarda as demais cópias (inclusive cópias extras do próprio campeão).
 */
export interface DeckList {
  legend: string | null;
  champion: string | null;
  main: Record<string, number>;
  side: Record<string, number>;
  runes: Record<string, number>;
  battlefields: string[];
  /** Lendas extras escolhidas por efeitos de construção (ex.: Neeko). */
  extraLegends: string[];
}

export type DeckFormat = "constructed" | "casual";

export interface DeckIssue {
  severity: "error" | "warning";
  /** Chave de mensagem (Builder.issues.<code>). */
  code: string;
  params?: Record<string, string | number>;
}

export const emptyDeck = (): DeckList => ({
  legend: null,
  champion: null,
  main: {},
  side: {},
  runes: {},
  battlefields: [],
  extraLegends: [],
});
