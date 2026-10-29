import { bracketStage, buildBracket } from "@cr/core";
import { getTranslations } from "next-intl/server";
import { TrophyIcon } from "@/components/Honors";
import { LegendAvatar } from "@/components/LegendAvatar";
import { Link } from "@/i18n/navigation";
import type { BracketMatch, LegendInfo } from "@/lib/queries";

interface Side {
  id: number | null;
  name: string | null;
  hidden: boolean | null;
  legend: string | null;
}

/** Chave do top cut: uma coluna por rodada, ligadas por linhas, e o campeão no fim. */
export async function Bracket({
  rounds,
  matches,
  seeds,
  legends,
}: {
  rounds: { id: number; status: string }[];
  matches: BracketMatch[];
  seeds: Map<number, number>;
  legends: Map<string, LegendInfo>;
}) {
  const t = await getTranslations("Event");
  const tc = await getTranslations("Common");
  const byRound = rounds.map((r) => matches.filter((m) => m.roundId === r.id));
  const cols = buildBracket(byRound, (p) => seeds.get(p));
  if (cols.length === 0) return <p className="mt-6 text-muted">{t("bracketNotStarted")}</p>;

  const final = cols.at(-1)?.[0];
  const champion = final && final.status === "COMPLETE" && final.winnerId !== null ? side(final, final.winnerId === final.p1 ? 1 : 2) : null;
  const stageLabel = (slots: number) => {
    const stage = bracketStage(slots);
    return stage === "final" ? t("bracketFinal") : stage === "semis" ? t("bracketSemis") : stage === "quarters" ? t("bracketQuarters") : t("bracketTop", { count: slots * 2 });
  };

  const name = (s: Side) => (s.hidden ? tc("hiddenPlayer") : (s.name ?? "—"));

  function Row({ m, s, n }: { m: BracketMatch; s: Side; n: 1 | 2 }) {
    const l = s.legend ? legends.get(s.legend) : undefined;
    const decided = m.status === "COMPLETE" && !m.isDraw && m.winnerId !== null;
    const won = decided && m.winnerId === s.id;
    const seed = s.id !== null ? seeds.get(s.id) : undefined;
    const games = m.isBye || !(m.status === "COMPLETE" || m.winnerId !== null) ? null : m.winnerId === s.id ? m.gamesWinner : m.gamesLoser;
    if (s.id === null) {
      return (
        <div className={`flex h-9 items-center gap-2 px-2.5 text-muted ${n === 2 ? "border-t border-border" : ""}`}>
          <span className="w-5" />
          <span className="italic">{m.isBye ? t("bye") : t("bracketTbd")}</span>
        </div>
      );
    }
    return (
      <div className={`flex h-9 items-center gap-2 px-2.5 ${n === 2 ? "border-t border-border" : ""} ${decided && !won ? "text-muted" : ""} ${won ? "font-semibold" : ""}`}>
        <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted" title={seed ? t("seedHint") : undefined}>{seed ?? ""}</span>
        {l ? <LegendAvatar cardId={l.cardId} champion={l.champion} domains={l.domains} size={22} /> : <span className="size-[22px] shrink-0" />}
        <span className="min-w-0 flex-1 truncate" title={l?.champion}>
          {!s.hidden && s.name ? (
            <Link href={`/players/${s.id}`} className="hover:text-accent">{s.name}</Link>
          ) : (
            name(s)
          )}
        </span>
        <span className={`w-4 text-right tabular-nums ${won ? "text-accent" : ""}`}>{games ?? ""}</span>
      </div>
    );
  }

  function Card({ m, first, last }: { m: BracketMatch | null; first: boolean; last: boolean }) {
    const live = m && m.status !== "COMPLETE" && m.p1 !== null && m.p2 !== null;
    return (
      <div className="relative mx-4 my-2">
        {!first && <span className="absolute right-full top-1/2 w-4 border-t border-border" aria-hidden />}
        {!last && <span className="absolute left-full top-1/2 w-4 border-t border-border" aria-hidden />}
        <div className={`overflow-hidden rounded-lg border bg-surface text-sm ${live ? "border-live/60" : "border-border"}`}>
          {m ? (
            <>
              <Row m={m} s={side(m, 1)} n={1} />
              <Row m={m} s={side(m, 2)} n={2} />
            </>
          ) : (
            <>
              <div className="flex h-9 items-center px-2.5 italic text-muted">{t("bracketTbd")}</div>
              <div className="flex h-9 items-center border-t border-border px-2.5 italic text-muted">{t("bracketTbd")}</div>
            </>
          )}
        </div>
        {live && (
          <p className="absolute -bottom-4 left-0 text-[11px] text-live">
            {m.table !== null ? `${t("table")} ${m.table} · ` : ""}
            {t("inProgress")}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-x-auto pb-4">
      <div className="flex min-w-max">
        {cols.map((col, j) => {
          const first = j === 0;
          const last = j === cols.length - 1;
          const pairs = last ? [col] : Array.from({ length: Math.ceil(col.length / 2) }, (_, i) => col.slice(2 * i, 2 * i + 2));
          return (
            <section key={j} className="flex w-72 flex-col" aria-label={stageLabel(col.length)}>
              <h3 className="mx-4 mb-1 text-xs font-medium uppercase tracking-wide text-muted">{stageLabel(col.length)}</h3>
              <div className="flex flex-1 flex-col justify-around">
                {pairs.map((pair, i) => (
                  <div key={i} className="relative flex flex-1 flex-col justify-around">
                    {!last && pair.length === 2 && <span className="absolute bottom-1/4 right-0 top-1/4 border-r border-border" aria-hidden />}
                    {pair.map((m, k) => (
                      <Card key={m?.id ?? `e${k}`} m={m} first={first} last={last && !champion} />
                    ))}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
        {champion && (
          <section className="flex w-64 flex-col" aria-label={t("champion")}>
            <h3 className="mx-4 mb-1 text-xs font-medium uppercase tracking-wide text-muted">{t("champion")}</h3>
            <div className="flex flex-1 flex-col justify-around">
              <div className="relative mx-4">
                <span className="absolute right-full top-1/2 w-4 border-t border-border" aria-hidden />
                <div className="flex items-center gap-2.5 rounded-lg border border-gold/60 bg-surface p-3">
                  <TrophyIcon size={20} />
                  {champion.legend && legends.get(champion.legend) && (
                    <LegendAvatar cardId={legends.get(champion.legend)!.cardId} champion={legends.get(champion.legend)!.champion} domains={legends.get(champion.legend)!.domains} size={28} />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block break-words font-semibold">
                      {!champion.hidden && champion.name ? <Link href={`/players/${champion.id}`} className="hover:text-accent">{champion.name}</Link> : name(champion)}
                    </span>
                    {champion.legend && legends.get(champion.legend) && <span className="block truncate text-xs text-muted">{legends.get(champion.legend)!.champion}</span>}
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function side(m: BracketMatch, n: 1 | 2): Side {
  return n === 1 ? { id: m.p1, name: m.p1Name, hidden: m.p1Hidden, legend: m.l1 } : { id: m.p2, name: m.p2Name, hidden: m.p2Hidden, legend: m.l2 };
}
