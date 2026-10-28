/** Recalcula as estatísticas agregadas a partir das partidas gravadas.  pnpm stats */
import "./env";
import { createDb } from "@cr/db";
import { recomputeStats } from "../recompute";

await recomputeStats(createDb(), console.log);
process.exit(0);
