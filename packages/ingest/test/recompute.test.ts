import { describe, expect, it } from "vitest";
import { aggregate, scopesFor } from "../src/recompute";

const m = (p1: number, p2: number, l1: string, l2: string, winner: number | null, eventId = 1) => ({
  eventId, metagame: "VEN", kind: "main", p1, p2, l1, l2, winner, isDraw: winner === null,
});

describe("scopesFor", () => {
  it("evento principal entra no metagame e no total, nos dois filtros de tipo", () => {
    expect(scopesFor("VEN", "main")).toEqual(["VEN:main", "VEN:all", "all:main", "all:all"]);
    expect(scopesFor(null, "side")).toEqual(["all:all"]);
    expect(scopesFor("RAD", "showdown")).toEqual(["RAD:showdown", "RAD:all", "all:showdown", "all:all"]);
  });
});

describe("aggregate", () => {
  // 16 jogadores: 1–8 de "a", 9–16 de "b"; "a" ganha 2 de 4 contra "b" e há um espelho.
  const matches = [m(1, 9, "a", "b", 1), m(2, 10, "a", "b", 10), m(11, 3, "b", "a", 3), m(12, 4, "b", "a", 12), m(5, 6, "a", "a", 5)];
  const entries = Array.from({ length: 16 }, (_, i) => ({
    eventId: 1, metagame: "VEN", kind: "main", playerId: i + 1, legend: i < 8 ? "a" : "b", rank: i + 1, fieldSize: 16,
  }));
  const r = aggregate(matches, entries).get("VEN:main")!;

  it("win rate da lenda exclui espelhos", () => {
    const a = r.legendRows.find((x) => x.legend === "a")!;
    expect([a.wins, a.losses]).toEqual([2, 2]);
    expect(a.share).toBe(0.5);
  });

  it("matchups são simétricos", () => {
    const ab = r.matchupRows.find((x) => x.legend === "a" && x.opponent === "b")!;
    const ba = r.matchupRows.find((x) => x.legend === "b" && x.opponent === "a")!;
    expect([ab.wins, ab.losses]).toEqual([ba.losses, ba.wins]);
  });

  it("lenda com menos de 8 pilotos fica fora", () => {
    const few = aggregate(matches, entries.slice(4, 11)).get("VEN:main")!;
    expect(few.legendRows).toHaveLength(0);
  });
});
