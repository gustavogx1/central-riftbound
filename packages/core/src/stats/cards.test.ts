import { describe, expect, it } from "vitest";
import { emptyDeck, type DeckList } from "../deck/types";
import { cardUsage, spiciness, type StatDeck } from "./cards";

const deck = (main: Record<string, number>, extra: Partial<DeckList> = {}): DeckList => ({ ...emptyDeck(), legend: "L", main, ...extra });
const sd = (d: DeckList, wins = 0, losses = 0): StatDeck => ({ deck: d, wins, losses });

describe("uso das cartas", () => {
  it("conta listas, cópias médias e campanha por zona; campeão conta no deck principal", () => {
    const u = cardUsage([
      sd(deck({ a: 3, b: 2 }, { champion: "c", battlefields: ["f1", "f2", "f3"], side: { a: 0, s: 2 } }), 5, 2),
      sd(deck({ a: 1, c: 2 }, { battlefields: ["f1"] }), 3, 3),
    ]);
    const get = (zone: string, id: string) => u.find((x) => x.zone === zone && x.cardId === id);
    expect(get("main", "a")).toMatchObject({ decks: 2, inclusion: 1, avgCopies: 2, wins: 8, losses: 5 });
    expect(get("main", "c")).toMatchObject({ decks: 2, avgCopies: 1.5 });
    expect(get("main", "b")).toMatchObject({ decks: 1, inclusion: 0.5 });
    expect(get("battlefields", "f1")?.decks).toBe(2);
    expect(get("side", "s")?.avgCopies).toBe(2);
    expect(get("side", "a")).toBeUndefined();
    expect(u[0]!.decks).toBe(2);
  });

  it("sem listas devolve vazio", () => {
    expect(cardUsage([])).toEqual([]);
  });
});

describe("tempero", () => {
  const field = [deck({ a: 3, b: 3 }), deck({ a: 3, b: 3 }), deck({ a: 3, b: 3 }), deck({ a: 3, b: 3 }), deck({ a: 3, b: 3 })];

  it("lista igual às outras = 0; lista sem nada em comum = 100", () => {
    const usage = cardUsage(field.map((d) => sd(d)));
    expect(spiciness(deck({ a: 3, b: 3 }), usage, field.length, false)).toBe(0);
    expect(spiciness(deck({ x: 3, y: 3 }), usage, field.length, false)).toBe(100);
  });

  it("tira a própria lista da conta e pesa pelas cópias", () => {
    const mine = deck({ a: 3, z: 1 });
    const all = [...field, mine];
    const usage = cardUsage(all.map((d) => sd(d)));
    // a: 5 de 5 outras (0); z: 0 de 5 (1) → 1 de 4 cópias = 25.
    expect(spiciness(mine, usage, all.length, true)).toBe(25);
  });

  it("precisa de listas suficientes", () => {
    const usage = cardUsage(field.slice(0, 3).map((d) => sd(d)));
    expect(spiciness(deck({ a: 1 }), usage, 3, false)).toBeNull();
  });
});
