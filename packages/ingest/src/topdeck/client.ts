/**
 * Cliente mínimo da API v2 do TopDeck.gg (https://topdeck.gg/docs/tournaments-v2).
 * Precisa de uma chave grátis (segredo TOPDECK_API_KEY). Só leitura, com intervalo
 * mínimo entre requisições (o limite é 100 por minuto) e novas tentativas no 429/5xx.
 * Os termos pedem crédito com link para o TopDeck.gg onde os dados aparecem.
 */
import { USER_AGENT } from "../uvs/client";

export const TOPDECK_BASE_URL = "https://topdeck.gg/api";

export interface TopdeckClientOptions {
  apiKey?: string;
  baseUrl?: string;
  minIntervalMs?: number;
  maxRetries?: number;
  fetch?: typeof fetch;
  log?: (msg: string) => void;
}

export class TopdeckClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly minIntervalMs: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof fetch;
  private readonly log: (msg: string) => void;
  private last = 0;
  requests = 0;

  constructor(opts: TopdeckClientOptions = {}) {
    const key = opts.apiKey ?? process.env.TOPDECK_API_KEY;
    if (!key) throw new Error("TOPDECK_API_KEY não definida");
    this.apiKey = key;
    this.baseUrl = opts.baseUrl ?? process.env.TOPDECK_BASE_URL ?? TOPDECK_BASE_URL;
    this.minIntervalMs = opts.minIntervalMs ?? (Number(process.env.TOPDECK_MIN_INTERVAL_MS) || 1500);
    this.maxRetries = opts.maxRetries ?? 4;
    this.fetchImpl = opts.fetch ?? fetch;
    this.log = opts.log ?? (() => {});
  }

  private async throttle() {
    const wait = this.last + this.minIntervalMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.last = Date.now();
  }

  async request<T>(path: string, parse: (data: unknown) => T, body?: unknown): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      await this.throttle();
      this.requests++;
      const res = await this.fetchImpl(`${this.baseUrl}/${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: { Authorization: this.apiKey, "User-Agent": USER_AGENT, Accept: "application/json", "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (res.ok) return parse(await res.json());
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= this.maxRetries) {
        throw new Error(`TopDeck ${res.status} em ${path}`);
      }
      const after = Number(res.headers.get("retry-after"));
      const delay = after > 0 ? after * 1000 : 2000 * 2 ** attempt;
      this.log(`TopDeck ${res.status} em ${path}; nova tentativa em ${delay / 1000}s`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}
