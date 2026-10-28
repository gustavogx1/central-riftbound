/**
 * Cliente mínimo da API pública da UVS/Spicerack (a mesma que o localizador
 * oficial de eventos usa). Só leitura, sem login, com intervalo mínimo entre
 * requisições e novas tentativas com espera crescente.
 */
export const UVS_BASE_URL = "https://api.cloudflare.riftbound.uvsgames.com/hydraproxy/api/v2";
export const USER_AGENT = "CentralRiftbound/0.1 (+https://github.com/gustavogx1/central-riftbound)";

export interface UvsClientOptions {
  baseUrl?: string;
  /** Intervalo mínimo entre duas requisições, em ms. */
  minIntervalMs?: number;
  maxRetries?: number;
  fetch?: typeof fetch;
  log?: (msg: string) => void;
}

export class UvsClient {
  private readonly baseUrl: string;
  private readonly minIntervalMs: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof fetch;
  private readonly log: (msg: string) => void;
  private last = 0;
  requests = 0;

  constructor(opts: UvsClientOptions = {}) {
    this.baseUrl = opts.baseUrl ?? UVS_BASE_URL;
    this.minIntervalMs = opts.minIntervalMs ?? 1500;
    this.maxRetries = opts.maxRetries ?? 4;
    this.fetchImpl = opts.fetch ?? fetch;
    this.log = opts.log ?? (() => {});
  }

  private async throttle() {
    const wait = this.last + this.minIntervalMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.last = Date.now();
  }

  async get<T>(path: string, parse: (data: unknown) => T): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      await this.throttle();
      this.requests++;
      const res = await this.fetchImpl(`${this.baseUrl}/${path}`, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      });
      if (res.ok) return parse(await res.json());
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= this.maxRetries) {
        throw new Error(`UVS ${res.status} em ${path}`);
      }
      const delay = 2000 * 2 ** attempt;
      this.log(`UVS ${res.status} em ${path}; nova tentativa em ${delay / 1000}s`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}
