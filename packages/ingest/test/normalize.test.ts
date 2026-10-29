import { describe, expect, it } from "vitest";
import { createLegendResolver, detectMetagame, matchRow, nickOf, parseRecord, playerFromStanding, playersFromMatch, roundRows, standingRow } from "../src/normalize";
import { page, uvsEvent, uvsMatch, uvsStanding } from "../src/uvs/schemas";
import eventFixture from "./fixtures/event.json";
import matchesFixture from "./fixtures/matches.json";
import standingsFixture from "./fixtures/standings.json";

const legends = [
  { slug: "nasus-curator-of-the-sands", champion: "Nasus", title: "Curator of the Sands", setId: "SFD" },
  { slug: "kennen-heart-of-the-tempest", champion: "Kennen", title: "Heart of the Tempest", setId: "VEN" },
  { slug: "kaisa-daughter-of-the-void", champion: "Kai'Sa", title: "Daughter of the Void", setId: "OGN" },
];
const resolve = createLegendResolver(legends);

describe("contrato da API da UVS", () => {
  it("aceita o formato real de evento, partidas e standings", () => {
    expect(() => uvsEvent.parse(eventFixture)).not.toThrow();
    expect(() => page(uvsMatch).parse(matchesFixture)).not.toThrow();
    expect(() => page(uvsStanding).parse(standingsFixture)).not.toThrow();
  });
});

describe("resolver de lendas", () => {
  it("casa nome completo, ignora acento e pontuação", () => {
    expect(resolve("Nasus, Curator of the Sands")).toBe("nasus-curator-of-the-sands");
    expect(resolve("Kai'Sa, Daughter of the Void")).toBe("kaisa-daughter-of-the-void");
    expect(resolve("KaiSa - Daughter of the Void")).toBe("kaisa-daughter-of-the-void");
  });
  it("aceita só o título quando não é ambíguo, e devolve null para desconhecidos", () => {
    expect(resolve("Heart of the Tempest")).toBe("kennen-heart-of-the-tempest");
    expect(resolve("Someone, Unknown Title")).toBeNull();
    expect(resolve(null)).toBeNull();
  });
});

describe("normalização", () => {
  const ev = uvsEvent.parse(eventFixture);

  it("gera rodadas com fase e ordem", () => {
    const rounds = roundRows(ev);
    expect(rounds).toHaveLength(5);
    expect(rounds[0]).toMatchObject({ id: 1261988, phaseName: "Pre-RQ Swiss", roundNumber: 1, pairingsReady: true });
  });

  it("gera partida com jogadores, lendas e vencedor", () => {
    const m = page(uvsMatch).parse(matchesFixture).results[0]!;
    expect(matchRow(m, 1261992, ev.id, resolve)).toMatchObject({
      id: 7169106,
      player1Id: 111167,
      player2Id: 94622,
      legend1: "nasus-curator-of-the-sands",
      legend2: "kennen-heart-of-the-tempest",
      winnerId: 111167,
      gamesWinner: 2,
      gamesLoser: 1,
      isBye: false,
      isDraw: false,
    });
  });

  it("marca bye quando só há um jogador", () => {
    const m = page(uvsMatch).parse(matchesFixture).results[1]!;
    expect(matchRow(m, 1261992, ev.id, resolve)).toMatchObject({ isBye: true, player2Id: null });
  });

  it("gera standing com recorde e lenda", () => {
    const s = page(uvsStanding).parse(standingsFixture).results[0]!;
    expect(standingRow(s, 1261992, ev.id, resolve)).toMatchObject({
      playerId: 111167,
      rank: 1,
      wins: 5,
      losses: 0,
      draws: 0,
      points: 15,
      omw: 0.72,
      legend: "nasus-curator-of-the-sands",
    });
  });

  it("lê recordes V-D-E", () => {
    expect(parseRecord("4-1-0")).toEqual({ wins: 4, losses: 1, draws: 0 });
    expect(parseRecord("3-2")).toEqual({ wins: 3, losses: 2, draws: 0 });
  });
});

describe("metagame", () => {
  const setOf = (slug: string) => legends.find((l) => l.slug === slug)?.setId;
  it("é o set mais novo entre as lendas com presença real", () => {
    expect(detectMetagame(new Map([["nasus-curator-of-the-sands", 90], ["kennen-heart-of-the-tempest", 10]]), setOf)).toBe("VEN");
  });
  it("ignora lenda com menos de 1% dos jogadores", () => {
    expect(detectMetagame(new Map([["nasus-curator-of-the-sands", 999], ["kennen-heart-of-the-tempest", 1]]), setOf)).toBe("SFD");
  });
});

describe("nick dos jogadores", () => {
  const start = new Date("2026-01-01T10:00:00Z");

  it("pega o nick da inscrição, separado do nome", () => {
    const m = page(uvsMatch).parse(matchesFixture).results[0]!;
    const [a] = playersFromMatch(m, start);
    expect(a).toMatchObject({ name: "Player A", nick: "Player B", nickAt: start });
    const s = page(uvsStanding).parse(standingsFixture).results[0]!;
    expect(playerFromStanding(s, start)).toMatchObject({ name: "Player A", nick: "Player B", nickAt: start });
  });

  it("trata vazio ou igual ao nome como sem nick", () => {
    expect(nickOf("Marc R", "  Ruizo ")).toBe("Ruizo");
    expect(nickOf("Marc R", "Marc R")).toBeNull();
    expect(nickOf("Marc R", "  ")).toBeNull();
    expect(nickOf("Marc R", null)).toBeNull();
  });
});
