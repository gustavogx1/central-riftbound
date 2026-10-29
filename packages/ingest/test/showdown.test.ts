import { describe, expect, it } from "vitest";
import { classifyShowdown } from "../src/showdown";
import type { UvsEventSummary } from "../src/uvs/schemas";

const ev = (name: string, players: number | null, extra: Partial<UvsEventSummary> = {}): UvsEventSummary => ({
  id: 1,
  name,
  start_datetime: "2026-09-12T14:00:00+00:00",
  starting_player_count: players,
  registered_user_count: 1,
  capacity: 1000,
  display_status: "complete",
  game_type: "RIFTBOUND",
  is_test_event: false,
  gameplay_format: { name: "Constructed" },
  ...extra,
});

describe("classifyShowdown", () => {
  it("aceita os eventos do Showdown Series (128+ jogadores)", () => {
    expect(classifyShowdown(ev("SCG CON Baltimore - Riftbound Showdown $25K", 941))).toBe("showdown");
    expect(classifyShowdown(ev("Showdown Series: Murcia Organized by Spellnexus", 765))).toBe("showdown");
    expect(classifyShowdown(ev("Gen.G LA Showdown Series", 128))).toBe("showdown");
  });
  it("separa os paralelos do fim de semana", () => {
    expect(classifyShowdown(ev("12:30 1v1 Constructed Showdown Grinder 1 - F2FTour Ottawa", 177))).toBe("side");
    expect(classifyShowdown(ev("SHOWDOWN REBOUND - LUCCA - 13/09", 83))).toBe("side");
    expect(classifyShowdown(ev("Daily Showdown Championship (FRIDAY)", 193))).toBe("side");
    expect(classifyShowdown(ev("Pre-Showdown Friday Speyer", 40))).toBeNull();
  });
  it("deixa de fora eventos de loja, limitados e de outros jogos", () => {
    expect(classifyShowdown(ev("Saturday Nexus Showdown", 12))).toBeNull();
    expect(classifyShowdown(ev("NRG Series: Riftbound $5k Constructed Showdown", 108))).toBeNull();
    expect(classifyShowdown(ev("SECRET BASE TCG UNLEASHED BOOSTER SHOWDOWN", 138))).toBeNull();
    expect(classifyShowdown(ev("Riftbound Showdown Sealed", 300, { gameplay_format: { name: "Sealed" } }))).toBeNull();
    expect(classifyShowdown(ev("Lorcana Showdown", 600, { game_type: "LORCANA" }))).toBeNull();
    expect(classifyShowdown(ev("Riftbound Showdown Series", 600, { is_test_event: true }))).toBeNull();
  });
  it("antes de começar usa inscritos e capacidade, para ligar o ao vivo a tempo", () => {
    expect(classifyShowdown(ev("CoolStuffCon Orlando 2026- Riftbound Showdown Series $25k", null, { display_status: "upcoming", capacity: 570 }))).toBe("showdown");
    expect(classifyShowdown(ev("Weekly Riftbound Showdown", null, { display_status: "upcoming", capacity: 16 }))).toBeNull();
    // Terminado: só vale quem jogou.
    expect(classifyShowdown(ev("Riftbound Showdown Series", 40, { capacity: 1000 }))).toBeNull();
  });
});
