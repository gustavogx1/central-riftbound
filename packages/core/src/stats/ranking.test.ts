import { describe, expect, it } from "vitest";
import { placementPoints, pointsCutoff, rankingTier, rankPlayers } from "./ranking";

describe("ranking de jogadores", () => {
  it("classifica o nível do evento", () => {
    expect(rankingTier("main", "Riftbound Regional Championship: Europe", 1500)).toBe("championship");
    expect(rankingTier("main", "Regional Qualifier Las Vegas", 900)).toBe("qualifier");
    expect(rankingTier("showdown", "Showdown", 600)).toBe("showdown1");
    expect(rankingTier("showdown", "Showdown", 300)).toBe("showdown2");
    expect(rankingTier("showdown", "Showdown", 140)).toBe("showdown3");
    expect(rankingTier("side", "Regional Rebound", 80)).toBe("side");
    expect(rankingTier("community", "Liga local", 40)).toBe("community");
  });

  it("dá a fração da faixa e só pontua o primeiro quarto (mínimo top 8)", () => {
    expect(placementPoints("qualifier", 1, 600)).toBe(500);
    expect(placementPoints("qualifier", 3, 600)).toBe(250);
    expect(placementPoints("qualifier", 150, 600)).toBe(15);
    expect(placementPoints("qualifier", 151, 600)).toBe(0);
    expect(pointsCutoff(20)).toBe(8);
    expect(placementPoints("community", 8, 20)).toBe(14);
    expect(placementPoints("community", 9, 20)).toBe(0);
  });

  it("soma por jogador, desempata por títulos e divide posição em empate total", () => {
    const r = rankPlayers([
      { playerId: 1, eventId: 10, kind: "main", eventName: "RQ", players: 400, rank: 2 }, // 350
      { playerId: 2, eventId: 10, kind: "main", eventName: "RQ", players: 400, rank: 1 }, // 500
      { playerId: 3, eventId: 11, kind: "showdown", eventName: "S", players: 300, rank: 1 }, // 200
      { playerId: 3, eventId: 10, kind: "main", eventName: "RQ", players: 400, rank: 3 }, // 250
      { playerId: 4, eventId: 12, kind: "showdown", eventName: "S", players: 300, rank: 2 }, // 140
      { playerId: 5, eventId: 12, kind: "showdown", eventName: "S", players: 300, rank: 2 }, // 140
      { playerId: 6, eventId: 12, kind: "showdown", eventName: "S", players: 300, rank: 200 }, // fora
    ]);
    expect(r.map((p) => [p.playerId, p.position, p.points])).toEqual([
      [2, 1, 500],
      [3, 2, 450],
      [1, 3, 350],
      [4, 4, 140],
      [5, 4, 140],
    ]);
    expect(r[1]).toMatchObject({ events: 2, wins: 1, bestRank: 1 });
  });
});
