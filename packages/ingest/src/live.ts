import { and, eq, gte, lte, sql } from "drizzle-orm";
import { type Db, schema } from "@cr/db";
import { ingestEvent } from "./ingest-event";
import { recomputeStats } from "./recompute";
import type { UvsClient } from "./uvs/client";

/** Antes do início, só consulta a UVS a partir deste tempo. */
export const LIVE_LEAD_MS = 30 * 60 * 1000;
/** Evento que nunca fecha na UVS deixa de ser ao vivo depois disto. */
export const LIVE_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
/** `pnpm live --arm` liga o ao vivo dos acompanhados que começam dentro desta janela. */
export const ARM_WINDOW_MS = 36 * 60 * 60 * 1000;

export type LiveDecision = "wait" | "tick" | "expire";

/**
 * O que fazer com um evento marcado como ao vivo. `startsAt` nulo = ainda não
 * importado (consulta para descobrir a data).
 */
export function liveDecision(startsAt: Date | null, now: Date): LiveDecision {
  if (!startsAt) return "tick";
  const t = startsAt.getTime();
  if (t - now.getTime() > LIVE_LEAD_MS) return "wait";
  if (now.getTime() - t > LIVE_MAX_AGE_MS) return "expire";
  return "tick";
}

export interface LiveTickResult {
  eventId: number;
  action: LiveDecision | "finished" | "error";
  changed?: boolean;
  version?: number;
  error?: string;
}

/**
 * Uma passada do ao vivo: atualiza os eventos marcados, sobe o pulso de quem
 * mudou e desliga quem terminou. Recalcula as estatísticas quando algum evento
 * termina (o recálculo diário cobre o resto).
 */
export async function liveTick(db: Db, client: UvsClient, opts: { now?: Date; log?: (msg: string) => void } = {}): Promise<LiveTickResult[]> {
  const now = opts.now ?? new Date();
  const log = opts.log ?? (() => {});
  const rows = await db
    .select({ t: schema.trackedEvent, startsAt: schema.event.startsAt })
    .from(schema.trackedEvent)
    .leftJoin(schema.event, eq(schema.event.id, schema.trackedEvent.uvsEventId))
    .where(eq(schema.trackedEvent.live, true));

  const results: LiveTickResult[] = [];
  let finished = false;
  for (const { t, startsAt } of rows) {
    const decision = liveDecision(startsAt, now);
    if (decision === "wait") {
      results.push({ eventId: t.uvsEventId, action: "wait" });
      continue;
    }
    if (decision === "expire") {
      await db.update(schema.trackedEvent).set({ live: false }).where(eq(schema.trackedEvent.uvsEventId, t.uvsEventId));
      log(`${t.uvsEventId}: começou há mais de 3 dias, ao vivo desligado`);
      results.push({ eventId: t.uvsEventId, action: "expire" });
      continue;
    }
    try {
      const r = await ingestEvent(db, client, t.uvsEventId, { kind: t.kind, metagameOverride: t.metagameOverride });
      const [prev] = await db.select().from(schema.liveState).where(eq(schema.liveState.eventId, t.uvsEventId));
      const changed = prev?.fingerprint !== r.fingerprint;
      const version = (prev?.version ?? 0) + (changed ? 1 : 0);
      await db
        .insert(schema.liveState)
        .values({ eventId: t.uvsEventId, version, fingerprint: r.fingerprint, checkedAt: now, changedAt: now })
        .onConflictDoUpdate({
          target: schema.liveState.eventId,
          set: changed ? { version, fingerprint: r.fingerprint, checkedAt: now, changedAt: now } : { checkedAt: now },
        });
      const done = r.status === "complete";
      if (done) {
        await db.update(schema.trackedEvent).set({ live: false }).where(eq(schema.trackedEvent.uvsEventId, t.uvsEventId));
        finished = true;
      }
      log(`${t.uvsEventId} ${r.event}: ${r.status}${changed ? `, mudou (v${version})` : ", sem mudança"}${done ? ", terminou" : ""}`);
      results.push({ eventId: t.uvsEventId, action: done ? "finished" : "tick", changed, version });
    } catch (err) {
      log(`${t.uvsEventId}: falhou: ${(err as Error).message}`);
      results.push({ eventId: t.uvsEventId, action: "error", error: (err as Error).message });
    }
  }
  if (finished) await recomputeStats(db, log);
  return results;
}

/**
 * Liga o ao vivo dos eventos acompanhados que começam em breve (ou começaram há
 * pouco) e ainda não terminaram. Roda junto da importação diária.
 */
export async function armLiveEvents(db: Db, now = new Date()) {
  const soon = await db
    .select({ id: schema.event.id })
    .from(schema.event)
    .innerJoin(schema.trackedEvent, eq(schema.trackedEvent.uvsEventId, schema.event.id))
    .where(
      and(
        eq(schema.trackedEvent.live, false),
        sql`${schema.event.status} <> 'complete'`,
        lte(schema.event.startsAt, new Date(now.getTime() + ARM_WINDOW_MS)),
        gte(schema.event.startsAt, new Date(now.getTime() - LIVE_MAX_AGE_MS)),
      ),
    );
  for (const { id } of soon) await db.update(schema.trackedEvent).set({ live: true }).where(eq(schema.trackedEvent.uvsEventId, id));
  return soon.map((r) => r.id);
}
