import { describe, expect, it } from "vitest";
import { LIVE_LEAD_MS, LIVE_MAX_AGE_MS, liveDecision } from "../src/live";
import { paginate, replayState, totalSteps, type Recording } from "../src/replay";
import { page, uvsEvent, uvsMatch } from "../src/uvs/schemas";
import eventFixture from "./fixtures/event.json";
import matchesFixture from "./fixtures/matches.json";

describe("decisão do ao vivo", () => {
  const now = new Date("2026-10-28T12:00:00Z");
  it("espera até 30 min antes do início", () => {
    expect(liveDecision(new Date(now.getTime() + LIVE_LEAD_MS + 1000), now)).toBe("wait");
    expect(liveDecision(new Date(now.getTime() + LIVE_LEAD_MS - 1000), now)).toBe("tick");
  });
  it("atualiza durante o evento e quando ainda não sabe a data", () => {
    expect(liveDecision(new Date(now.getTime() - 5 * 3600_000), now)).toBe("tick");
    expect(liveDecision(null, now)).toBe("tick");
  });
  it("desliga eventos que nunca fecharam na UVS depois de 3 dias", () => {
    expect(liveDecision(new Date(now.getTime() - LIVE_MAX_AGE_MS - 1000), now)).toBe("expire");
  });
});

/** Gravação mínima: duas rodadas suíças com as partidas reais anonimizadas da fixture. */
function recording(): Recording {
  const ev = structuredClone(eventFixture) as unknown as Recording["event"];
  const phase = { ...ev.tournament_phases[0]!, rounds: ev.tournament_phases[0]!.rounds.slice(0, 2) };
  ev.tournament_phases = [phase];
  const ms = (matchesFixture as { results: Recording["rounds"][string]["matches"] }).results.slice(0, 6);
  const [r1, r2] = phase.rounds;
  return {
    event: ev,
    rounds: {
      [r1!.id]: { matches: ms.slice(0, 3), standings: [{ rank: 1, tag: "r1" }] },
      [r2!.id]: { matches: ms.slice(3, 6), standings: [{ rank: 1, tag: "r2" }] },
    },
  };
}

describe("simulador", () => {
  const rec = recording();
  const [r1, r2] = rec.event.tournament_phases[0]!.rounds;
  const reported = (state: ReturnType<typeof replayState>, id: number) =>
    state.matches.get(id)!.filter((m) => m.match_is_bye || m.winning_player !== null || m.status === "COMPLETE").length;

  it("tem quatro passos por rodada", () => {
    expect(totalSteps(rec)).toBe(8);
  });

  it("começa com a rodada 1 aberta, sem resultados e sem standings", () => {
    const s = replayState(rec, 0);
    const rounds = s.event.tournament_phases as { rounds: { id: number; status: string; standings_status: string | null }[] }[];
    expect(rounds[0]!.rounds.map((r) => r.id)).toEqual([r1!.id]);
    expect(rounds[0]!.rounds[0]!.status).toBe("IN_PROGRESS");
    expect(rounds[0]!.rounds[0]!.standings_status).toBeNull();
    expect(s.event.display_status).toBe("inProgress");
    expect(s.event.timer_is_running).toBe(true);
    const byes = s.matches.get(r1!.id)!.filter((m) => m.match_is_bye).length;
    expect(reported(s, r1!.id)).toBe(byes);
  });

  it("solta metade dos resultados, depois todos, depois fecha a rodada", () => {
    const half = replayState(rec, 1);
    expect(reported(half, r1!.id)).toBeGreaterThan(0);
    expect(reported(half, r1!.id)).toBeLessThan(3);
    const all = replayState(rec, 2);
    expect(all.matches.get(r1!.id)).toEqual(rec.rounds[r1!.id]!.matches);
    expect(all.event.timer_is_running).toBe(false);
    const closed = replayState(rec, 3);
    const round = (closed.event.tournament_phases as { rounds: { status: string }[] }[])[0]!.rounds[0]!;
    expect(round.status).toBe("COMPLETE");
  });

  it("mostra as standings anteriores até os resultados da rodada nova entrarem", () => {
    expect(replayState(rec, 4).standings.get(r2!.id)).toEqual([{ rank: 1, tag: "r1" }]);
    expect(replayState(rec, 6).standings.get(r2!.id)).toEqual([{ rank: 1, tag: "r2" }]);
  });

  it("termina como evento completo, e o estado segue o contrato da UVS", () => {
    const end = replayState(rec, 99);
    expect(end.finished).toBe(true);
    expect(end.event.display_status).toBe("complete");
    expect(() => uvsEvent.parse(end.event)).not.toThrow();
    expect(() => page(uvsMatch).parse(paginate(replayState(rec, 1).matches.get(r1!.id)!, 1, 500))).not.toThrow();
  });

  it("pagina como a UVS", () => {
    expect(paginate([1, 2, 3], 1, 2)).toEqual({ count: 3, next: 2, results: [1, 2] });
    expect(paginate([1, 2, 3], 2, 2)).toEqual({ count: 3, next: null, results: [3] });
  });
});
