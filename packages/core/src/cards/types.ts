/** Uma linha do cards.json extraído da galeria oficial. */
export interface RawCard {
  id: string;
  code: string;
  name: string;
  subtitle: string;
  set: string;
  set_name: string;
  collector_number: number;
  public_code: string;
  variant: string;
  rarity: string;
  type: string;
  subtypes: string;
  tags: string;
  domains: string[];
  energy_cost: string;
  power_cost: string;
  might: string;
  might_bonus: string;
  rules_text: string;
  effect_text: string;
  artist: string;
  orientation: string;
  image_url: string;
  same_card_as: string;
}

export const DOMAINS = ["Fury", "Calm", "Mind", "Body", "Chaos", "Order"] as const;
export type Domain = (typeof DOMAINS)[number];

export const CARD_TYPES = ["Legend", "Unit", "Spell", "Gear", "Rune", "Battlefield"] as const;
export type CardType = (typeof CARD_TYPES)[number];

/** Carta base: as regras do jogo e as estatísticas são sempre por carta base. */
export interface Card {
  id: string;
  name: string;
  subtitle: string | null;
  type: CardType | null;
  supertypes: string[];
  tags: string[];
  domains: Domain[];
  energyCost: number | null;
  powerCost: number | null;
  might: number | null;
  mightBonus: number | null;
  rulesText: string;
  effectText: string;
}

/** Impressão: arte, set, número e raridade. Variantes apontam para a carta base. */
export interface CardPrint {
  id: string;
  cardId: string;
  code: string;
  publicCode: string;
  setId: string;
  collectorNumber: number;
  variant: string | null;
  rarity: string | null;
  artist: string | null;
  orientation: "portrait" | "landscape";
  imageFile: string;
}

export interface Legend {
  slug: string;
  cardId: string;
  champion: string;
  title: string;
  domains: Domain[];
}

export interface CardSet {
  id: string;
  name: string;
  printCount: number;
}

export interface Catalog {
  generatedAt: string;
  sets: CardSet[];
  cards: Card[];
  prints: CardPrint[];
  legends: Legend[];
}
