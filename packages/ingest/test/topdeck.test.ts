import { decodeDeck, type PoolCard } from "@cr/core";
import { describe, expect, it } from "vitest";
import { classifyTopdeck, convertDeck, deckObjToText, matchPlayers, matchUvsEvent, ownKeys, ownRows, shortName } from "../src/topdeck/normalize";
import { tdBulk, type TdRound, type TdStanding } from "../src/topdeck/schemas";

describe("classifyTopdeck", () => {
  it("aceita Showdowns, Regionals e majors com 128+ jogadores", () => {
    expect(classifyTopdeck("LDXP Sacramento - Riftbound Showdown 25k", 755)).toBe("showdown");
    expect(classifyTopdeck("Riftbound $10,000 Cash Tournament @ Pro-Play Summit: Orlando", 400)).toBe("showdown");
    expect(classifyTopdeck("Riftbound Regional Qualifier - Kuala Lumpur", 900)).toBe("main");
    expect(classifyTopdeck("CCS $25,000 Showdown Series Event - Riftbound Invitational Qualifier #5", 512)).toBe("showdown");
  });
  it("deixa de fora loja, paralelos e limitados", () => {
    expect(classifyTopdeck("Sunday Monthly: Riftbound", 300)).toBeNull();
    expect(classifyTopdeck("Riftbound Showdown 25k", 64)).toBeNull();
    expect(classifyTopdeck("Showdown Grinder 2", 200)).toBeNull();
    expect(classifyTopdeck("Pre-Regional Challenge - RQ Vancouver", 1200)).toBeNull();
    expect(classifyTopdeck("Riftbound Showdown Sealed", 300)).toBeNull();
  });
});

describe("matchUvsEvent", () => {
  const c = (id: number, name: string, iso: string, playerCount: number) => ({ id, name, startsAt: new Date(iso), playerCount });
  const td = { name: "Riftbound Showdown Series $25,000 Cash Tournament @ Pro-Play Summit: Dallas", startsAt: new Date("2026-07-04T15:00:00Z"), players: 495 };
  it("casa pelo fim de semana e pelo tamanho", () => {
    const hit = matchUvsEvent(td, [c(1, "Road to 10K Showdown", "2026-07-04T15:00:00Z", 11), c(733862, "Pro-Play Summit: Dallas - $25k Riftbound Showdown", "2026-07-04T14:00:00Z", 491)]);
    expect(hit?.id).toBe(733862);
  });
  it("não casa com evento de outra data ou de outro tamanho", () => {
    expect(matchUvsEvent(td, [c(2, "Pro-Play Summit: Dallas", "2026-07-08T14:00:00Z", 491)])).toBeNull();
    expect(matchUvsEvent(td, [c(3, "Dallas Grinder", "2026-07-04T14:00:00Z", 200)])).toBeNull();
  });
});

describe("matchPlayers", () => {
  it("casa nome completo com o \"Nome I\" da UVS e com o nick", () => {
    expect(shortName("Nam Dang")).toBe("nam d");
    const pairs = matchPlayers(
      [
        { id: "a", name: "Nam Dang", rank: 1, legend: "riven" },
        { id: "b", name: "xXRiftKingXx", rank: 2, legend: "jinx" },
        { id: "c", name: "José Silva", rank: 3, legend: null },
      ],
      [
        { playerId: 10, name: "Nam D", nick: null, rank: 1, legend: "riven" },
        { playerId: 11, name: "Pedro A", nick: "xXRiftKingXx", rank: 2, legend: "jinx" },
        { playerId: 12, name: "Jose S", nick: null, rank: 5, legend: "ahri" },
      ],
    );
    expect([...pairs]).toEqual([["a", 10], ["b", 11], ["c", 12]]);
  });
  it("desempata pela lenda e deixa sem par quando não dá para saber", () => {
    const uvs = [
      { playerId: 1, name: "Ana L", nick: null, rank: 10, legend: "jinx" },
      { playerId: 2, name: "Ana L", nick: null, rank: 30, legend: "ahri" },
    ];
    expect(matchPlayers([{ id: "x", name: "Ana Lima", rank: 29, legend: "jinx" }], uvs).get("x")).toBe(1);
    expect(matchPlayers([{ id: "y", name: "Ana Lopes", rank: 20, legend: null }], uvs).get("y")).toBeUndefined();
  });
});

/** Cartas fictícias com a forma das reais (nada do banco de cartas entra no git). */
function card(code: string, over: Partial<PoolCard> = {}): PoolCard {
  return { id: code.toLowerCase(), code, codes: [code], name: `Card ${code}`, subtitle: null, type: "Unit", supertypes: [], tags: [], domains: ["Calm"],
    energyCost: 2, powerCost: null, might: 2, rulesText: "", setId: code.slice(0, 3), number: Number(code.slice(4)) || 0, rarity: "Common", ...over };
}
const legend = card("UNL-001", { type: "Legend", name: "The Exile", tags: ["Riven"], domains: ["Calm", "Chaos"] });
const champ = card("UNL-002", { name: "Riven", subtitle: "Broken Blade", supertypes: ["Champion"], tags: ["Riven"] });
const crab = card("OGN-010", { name: "Scuttle Crab" });
const rune = card("OGN-042", { type: "Rune", name: "Calm Rune", supertypes: ["Basic"] });
const field = card("OGN-280", { type: "Battlefield", name: "Star Spring", domains: [] });
const hush = card("OGN-050", { type: "Spell", name: "Hush" });
const pool = new Map([legend, champ, crab, rune, field, hush].map((c) => [c.id, c]));

describe("decklists", () => {
  const deckObj = {
    Legend: { "Riven, The Exile": { count: 1 } },
    Champion: { "Riven, Broken Blade": 1 },
    Runes: { "Calm Rune": 12 },
    Battlefields: [{ name: "Star Spring", count: 1 }],
    Mainboard: { "Scuttle Crab": { quantity: 3 }, "Riven, Broken Blade": 2 },
    Sideboard: { Hush: 2, "Carta Que Não Existe": 1 },
  };
  it("deckObj vira texto por seção", () => {
    expect(deckObjToText(deckObj)).toContain("Mainboard:\n3 Scuttle Crab\n2 Riven, Broken Blade");
  });
  it("vira o nosso código de deck, guardando o que não reconheceu", () => {
    const d = convertDeck({ deckObj, decklist: null }, pool);
    expect(d.legendCardId).toBe(legend.id);
    expect(d.unknown).toEqual(["1 Carta Que Não Existe"]);
    const back = decodeDeck(d.code!, pool).deck;
    expect(back.champion).toBe(champ.id);
    expect(back.main).toEqual({ [crab.id]: 3, [champ.id]: 2 });
    expect(back.runes).toEqual({ [rune.id]: 12 });
    expect(back.side).toEqual({ [hush.id]: 2 });
  });
  it("lê a lista em texto e ignora quando é só um link", () => {
    expect(convertDeck({ deckObj: null, decklist: "Legend:\n1 Riven, The Exile\nMain Deck:\n3x Scuttle Crab" }, pool).legendCardId).toBe(legend.id);
    expect(convertDeck({ deckObj: null, decklist: "https://topdeck.gg/deck/x/y" }, pool).code).toBeNull();
  });
});

describe("ownRows", () => {
  const standings: TdStanding[] = [
    { standing: 1, name: "Nam Dang", id: "a", points: 9, opponentWinRate: 0.6, leader: "Riven, The Exile" },
    { standing: 2, name: "Bo", id: "b", points: 6, leader: "Jinx, Loose Cannon" },
    { standing: 3, name: "Cy", id: "c", points: 3, leader: null },
  ];
  const rounds: TdRound[] = [
    { round: 1, tables: [
      { table: 1, players: [{ name: "Nam Dang", id: "a" }, { name: "Bo", id: "b" }], winner: "Nam Dang", winner_id: "a", winner_games: 2, loser_games: 1, status: "Completed" },
      { table: "Byes", players: [{ name: "Cy", id: "c" }], status: "Bye" },
    ] },
    { round: 2, tables: [{ table: 1, players: [{ name: "Bo", id: "b" }, { name: "Cy", id: "c" }], winner_id: "Draw", status: "Completed" }] },
    { round: "Top 2", tables: [{ table: 1, players: [{ name: "Nam Dang", id: "a" }, { name: "Bo", id: "b" }], winner_id: "a", winner_games: 2, loser_games: 0, status: "Completed" }] },
  ];
  const keys = ownKeys("t1", rounds, standings);
  const ids = new Map(keys.map((k, i) => [k, -(i + 1)]));
  const ref = (k: string) => ids.get(k)!;
  const resolve = (n: string | null | undefined) => (n ? n.split(",")[0]!.toLowerCase() : null);
  const rows = ownRows("t1", rounds, standings, ref, resolve);

  it("usa ids negativos estáveis e separa suíço do corte", () => {
    expect(rows.eventId).toBe(ref("e:t1"));
    expect(rows.roundRows.map((r) => [r.phaseName, r.phaseOrder, r.roundNumber])).toEqual([["Swiss", 1, 1], ["Swiss", 1, 2], ["Top 2", 2, 1]]);
    expect(rows.swissRounds).toBe(2);
    expect(rows.matchRows.every((m) => m.id < 0)).toBe(true);
  });
  it("partidas com vencedor, bye e empate", () => {
    const [m1, bye, draw] = rows.matchRows;
    expect(m1).toMatchObject({ winnerId: ref("p:a"), legend1: "riven", legend2: "jinx", gamesWinner: 2, gamesLoser: 1, isDraw: false });
    expect(bye).toMatchObject({ isBye: true, player1Id: ref("p:c"), player2Id: null });
    expect(draw).toMatchObject({ isDraw: true, winnerId: null });
  });
  it("classificação na última rodada do suíço, com a campanha do suíço", () => {
    expect(rows.standingRows.every((s) => s.roundId === ref("r:t1:2"))).toBe(true);
    expect(rows.standingRows.map((s) => [s.rank, s.wins, s.losses, s.draws])).toEqual([[1, 1, 0, 0], [2, 0, 1, 1], [3, 1, 0, 1]]);
  });
});

describe("tdBulk", () => {
  it("aceita topCut e swissNum vindos como texto", () => {
    const base = { TID: "x", tournamentName: "Melbourne Showdown", startDate: 1_790_000_000 };
    const parsed = tdBulk.parse([
      { ...base, topCut: "8", swissNum: "9" },
      { ...base, topCut: "", swissNum: null },
      { ...base, topCut: 16, swissNum: 8 },
    ]);
    expect(parsed.map((t) => [t.topCut, t.swissNum])).toEqual([
      [8, 9],
      [null, null],
      [16, 8],
    ]);
  });
});
