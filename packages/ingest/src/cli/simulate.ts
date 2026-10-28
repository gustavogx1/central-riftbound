/**
 * Simulador da API da UVS que reproduz um evento gravado como se fosse ao vivo.
 *   pnpm simulate data/recordings/1233879.json [--port 8787] [--step 30] [--from 0]
 * Em outro terminal: UVS_BASE_URL=http://localhost:8787 UVS_MIN_INTERVAL_MS=0 pnpm live --watch --every 10
 * Cada passo dura --step segundos; uma rodada tem 4 passos.
 */
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { paginate, replayState, STEPS_PER_ROUND, totalSteps, type Recording } from "../replay";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { port: { type: "string", default: "8787" }, step: { type: "string", default: "30" }, from: { type: "string", default: "0" } },
});
if (!positionals[0]) {
  console.log("Uso: pnpm simulate <gravação.json>");
  process.exit(1);
}
const rec = JSON.parse(readFileSync(resolve(process.env.INIT_CWD ?? process.cwd(), positionals[0]), "utf8")) as Recording;
const stepMs = Number(values.step) * 1000;
const started = Date.now();
const stepNow = () => Number(values.from) + Math.floor((Date.now() - started) / stepMs);

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  // O relógio da rodada conta a partir do início do passo (fica estável dentro dele, como na UVS).
  const step = stepNow();
  const state = replayState(rec, step, new Date(started + (step - Number(values.from)) * stepMs));
  const page = Number(url.searchParams.get("page")) || 1;
  const size = Number(url.searchParams.get("page_size")) || 100;
  let body: unknown;
  let m: RegExpMatchArray | null;
  if ((m = url.pathname.match(/^\/events\/(\d+)\/?$/)) && Number(m[1]) === rec.event.id) body = state.event;
  else if ((m = url.pathname.match(/^\/tournament-rounds\/(\d+)\/matches\/paginated\/?$/))) body = paginate(state.matches.get(Number(m[1])) ?? [], page, size);
  else if ((m = url.pathname.match(/^\/tournament-rounds\/(\d+)\/standings\/paginated\/?$/))) body = paginate(state.standings.get(Number(m[1])) ?? [], page, size);
  res.writeHead(body ? 200 : 404, { "content-type": "application/json" });
  res.end(JSON.stringify(body ?? { detail: "Not found." }));
});

server.listen(Number(values.port), () => {
  const total = totalSteps(rec);
  console.log(`Simulando "${rec.event.name}" em http://localhost:${values.port} (${total / STEPS_PER_ROUND} rodadas, ${total} passos de ${values.step}s)`);
  const timer = setInterval(() => {
    const s = stepNow();
    console.log(`passo ${Math.min(s, total)}/${total}: rodada ${Math.min(Math.floor(s / STEPS_PER_ROUND) + 1, total / STEPS_PER_ROUND)}, etapa ${(s % STEPS_PER_ROUND) + 1}`);
    if (s > total) {
      clearInterval(timer);
      console.log("Evento terminado; o simulador segue respondendo com o estado final.");
    }
  }, stepMs);
});
