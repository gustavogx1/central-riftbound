import { describe, expect, it } from "vitest";
import { bestOfByLegend } from "./honors";

describe("best of por lenda", () => {
  it("escolhe a melhor colocação de cada lenda e ignora lenda de um jogador só", () => {
    const r = bestOfByLegend([
      { playerId: 1, rank: 3, legend: "ahri" },
      { playerId: 2, rank: 1, legend: "ahri" },
      { playerId: 3, rank: 2, legend: "jinx" },
      { playerId: 4, rank: 5, legend: "jinx" },
      { playerId: 5, rank: 4, legend: "teemo" },
      { playerId: 6, rank: 6, legend: null },
    ]);
    expect(Object.fromEntries(r)).toEqual({ ahri: 2, jinx: 3 });
  });

  it("aceita outro mínimo de pilotos", () => {
    expect(bestOfByLegend([{ playerId: 5, rank: 4, legend: "teemo" }], 1).get("teemo")).toBe(5);
  });
});
