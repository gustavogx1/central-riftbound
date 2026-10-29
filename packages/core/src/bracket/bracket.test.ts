import { describe, expect, it } from "vitest";
import { buildBracket, seedPositions } from ".";

const m = (p1: number | null, p2: number | null, id = `${p1}-${p2}`) => ({ id, p1, p2 });
// Seed = número do jogador.
const seed = (p: number) => p;

describe("chave do top cut", () => {
  it("ordem padrão dos seeds", () => {
    expect(seedPositions(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    expect(seedPositions(4)).toEqual([1, 4, 2, 3]);
  });

  it("monta a chave seguindo quem jogou com quem, não a ordem das mesas", () => {
    // Mesas como a UVS manda: 1v8, 2v7, 3v6, 4v5.
    const qf = [m(1, 8), m(2, 7), m(3, 6), m(4, 5)];
    const sf = [m(1, 4), m(7, 3)];
    const f = [m(1, 7)];
    const cols = buildBracket([qf, sf, f], seed);
    expect(cols.map((c) => c.map((x) => x?.id ?? null))).toEqual([
      ["1-8", "4-5", "2-7", "3-6"],
      ["1-4", "7-3"],
      ["1-7"],
    ]);
  });

  it("sem rodadas seguintes, usa a posição padrão do seed e deixa as vagas vazias", () => {
    const cols = buildBracket([[m(1, 8), m(2, 7), m(3, 6), m(4, 5)]], seed);
    expect(cols.map((c) => c.map((x) => x?.id ?? null))).toEqual([
      ["1-8", "4-5", "2-7", "3-6"],
      [null, null],
      [null],
    ]);
  });

  it("semifinal parcial ao vivo: a que já saiu puxa as quartas dela, o resto vai pelo seed", () => {
    const qf = [m(1, 8), m(2, 7), m(3, 6), m(4, 5)];
    const cols = buildBracket([qf, [m(6, 7)]], seed);
    expect(cols.map((c) => c.map((x) => x?.id ?? null))).toEqual([
      ["1-8", "4-5", "3-6", "2-7"],
      [null, "6-7"],
      [null],
    ]);
  });

  it("sem seeds, mantém a ordem recebida", () => {
    const cols = buildBracket([[m(10, 20), m(30, 40)], [m(30, 10)]]);
    expect(cols.map((c) => c.map((x) => x?.id ?? null))).toEqual([["30-40", "10-20"], ["30-10"]]);
  });

  it("sem partidas, sem chave", () => {
    expect(buildBracket([])).toEqual([]);
  });
});
