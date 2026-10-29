import { describe, expect, it } from "vitest";
import { classifyRegional, classifyShowdown } from "../src/showdown";
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

describe("classifyRegional", () => {
  it("aceita os Regionais e os paralelos do fim de semana", () => {
    expect(classifyRegional(ev("Riftbound Regional Qualifier - Las Vegas", 1670))).toBe("main");
    expect(classifyRegional(ev("Riftbound Regional Qualifier: Lille", 1949, { capacity: 1 }))).toBe("main");
    expect(classifyRegional(ev("Regional Rebound - RQ Las Vegas", 418))).toBe("side");
    expect(classifyRegional(ev("Pre-Regional Challenge - RQ Sydney Friday 1pm", 714))).toBe("side");
    expect(classifyRegional(ev("Secretlab Regional Rebound - RQ Barcelona Sunday 11am", 1003))).toBe("side");
    expect(classifyRegional(ev("Super Nexus Night - RQ Los Angeles Friday 8pm", 1972))).toBe("side");
    expect(classifyRegional(ev("Super Saturday Standard Challenge - RQ Hartford Saturday 10am", 432))).toBe("side");
  });
  it("aceita o Regional que ainda vai começar pelo total de inscritos", () => {
    expect(classifyRegional(ev("Riftbound Regional Championship: Europe", 311, { display_status: "upcoming", capacity: 8 }))).toBe("main");
  });
  it("deixa de fora eventos de loja e de outros jogos", () => {
    expect(classifyRegional(ev("Road to Regionals: Testing Tournament 1/2 @Damnation 2026", 81))).toBeNull();
    expect(classifyRegional(ev("Store Regional Championship", 40))).toBeNull();
    expect(classifyRegional(ev("Lorcana Regional Qualifier", 900, { game_type: "LORCANA" }))).toBeNull();
    expect(classifyRegional(ev("2v2 Champions of the Rift - RQ Los Angeles Sunday 10am", 543))).toBeNull();
    expect(classifyRegional(ev("Sealed Deck Challenge - RQ Singapore Sunday 2pm", 280))).toBeNull();
    expect(classifyRegional(ev("Champion Deck Trial - RQ Los Angeles Sunday 3pm", 26, { gameplay_format: { name: "Modified Champion Deck" } }))).toBeNull();
    expect(classifyRegional(ev("Riftbound Regional Qualifier - Sealed", 900, { gameplay_format: { name: "Sealed" } }))).toBeNull();
  });
});
