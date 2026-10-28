import { describe, expect, it } from "vitest";
import { conversionRate, shrunkConversion } from "./conversion";
import { computePower, tierFor } from "./power";
import { designEffect, pilotScore, shrunkWinRate, wilson, winRate } from "./winrate";

describe("win rate", () => {
  it("ignora empates e devolve null sem partidas", () => {
    expect(winRate({ wins: 3, losses: 1, draws: 2 })).toBe(0.75);
    expect(winRate({ wins: 0, losses: 0, draws: 4 })).toBeNull();
  });

  it("Wilson 95% de 5-0 ≈ 56,6%–100%", () => {
    // p=1, z²=3,8415: centro=(1+0,3841)/1,7683=0,7828; meia-largura=1,96·√(0,0384)/1,7683=0,2172
    const { low, high } = wilson(5, 5);
    expect(low).toBeCloseTo(0.5655, 3);
    expect(high).toBe(1);
  });

  it("Wilson de 50/100 é simétrico em torno de 50%", () => {
    const { low, high } = wilson(50, 100);
    expect(low).toBeCloseTo(0.4038, 3);
    expect(high).toBeCloseTo(0.5962, 3);
  });

  it("win rate ajustado puxa para 50% com poucas partidas", () => {
    expect(shrunkWinRate({ wins: 5, losses: 0, draws: 0 })).toBeCloseTo(55 / 105, 6);
    expect(shrunkWinRate({ wins: 600, losses: 400, draws: 0 })).toBeCloseTo(650 / 1100, 6);
  });
});

describe("Kish e nota de piloto", () => {
  it("deff = 1 + (m−1)ρ com m = Σn²/Σn", () => {
    expect(designEffect([5], 0.05)).toBeCloseTo(1.2, 9);
    // [5, 5]: m = 50/10 = 5 → mesmo deff; [9, 1]: m = 82/10 = 8,2 → 1,36
    expect(designEffect([5, 5], 0.05)).toBeCloseTo(1.2, 9);
    expect(designEffect([9, 1], 0.05)).toBeCloseTo(1.36, 9);
    expect(designEffect([])).toBe(1);
  });

  it("5-0 num evento vale menos que 5-0 sem correção", () => {
    const corrected = pilotScore([{ wins: 5, losses: 0 }]);
    expect(corrected).toBeLessThan(wilson(5, 5).low);
    expect(corrected).toBeCloseTo(wilson(5 / 1.2, 5 / 1.2).low, 9);
  });

  it("mesmas partidas espalhadas em mais eventos valem mais", () => {
    const one = pilotScore([{ wins: 16, losses: 4 }]);
    const four = pilotScore([
      { wins: 4, losses: 1 },
      { wins: 4, losses: 1 },
      { wins: 4, losses: 1 },
      { wins: 4, losses: 1 },
    ]);
    expect(four).toBeGreaterThan(one);
  });
});

describe("conversão", () => {
  it("conta quem ficou no Top 25% contra o esperado", () => {
    // campo de 8 → corte 2. Lenda A: 2 entradas, ranks 1 e 2 → 2 acertos / 0,5 esperado = 4,0
    const placements = [1, 2, 3, 4, 5, 6, 7, 8].map((rank) => ({
      eventId: "e1",
      legend: rank <= 2 ? "a" : "b",
      rank,
      fieldSize: 8,
    }));
    const c = conversionRate(placements, 0.25);
    expect(c.get("a")).toEqual({ entries: 2, hits: 2, conversion: 4 });
    expect(c.get("b")).toEqual({ entries: 6, hits: 0, conversion: 0 });
  });

  it("conversão ajustada fica em 1 sem dados", () => {
    expect(shrunkConversion(0, 0)).toBe(1);
    expect(shrunkConversion(2, 0.5, 20, 0.25)).toBeCloseTo(7 / 5.5, 9);
  });
});

describe("poder e tiers", () => {
  it("ordena por combinação e devolve percentis de 0 a 100", () => {
    const p = computePower([
      { id: "fraca", shrunkWinRate: 0.45, conversion: 0.7 },
      { id: "media", shrunkWinRate: 0.5, conversion: 1 },
      { id: "forte", shrunkWinRate: 0.56, conversion: 1.4 },
    ]);
    expect(p.get("fraca")).toEqual({ power: 0, tier: "D" });
    expect(p.get("media")).toEqual({ power: 50, tier: "B" });
    expect(p.get("forte")).toEqual({ power: 100, tier: "S" });
  });

  it("empates recebem o mesmo poder", () => {
    const p = computePower([
      { id: "x", shrunkWinRate: 0.5, conversion: 1 },
      { id: "y", shrunkWinRate: 0.5, conversion: 1 },
    ]);
    expect(p.get("x")!.power).toBe(p.get("y")!.power);
  });

  it("faixas de tier", () => {
    expect([95, 90, 89, 70, 40, 39, 15, 14, 0].map((v) => tierFor(v))).toEqual(["S", "S", "A", "A", "B", "C", "C", "D", "D"]);
  });
});
