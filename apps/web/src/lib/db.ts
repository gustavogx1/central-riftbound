import "server-only";
import { createDb, type Db } from "@cr/db";

const globalForDb = globalThis as unknown as { crDb?: Db | null };

/** Conexão única por processo. `null` quando DATABASE_URL não está definida (ex.: build no CI). */
export function getDb(): Db | null {
  if (globalForDb.crDb === undefined) {
    globalForDb.crDb = process.env.DATABASE_URL ? createDb(process.env.DATABASE_URL) : null;
  }
  return globalForDb.crDb;
}
