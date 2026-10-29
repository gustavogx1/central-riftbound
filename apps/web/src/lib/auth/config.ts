/**
 * Login pelo Supabase Auth. Sem as duas variáveis públicas, o site funciona igual,
 * só sem login (botão some, salvar e votar ficam indisponíveis).
 */
export const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const authEnabled = SUPABASE_URL !== "" && SUPABASE_KEY !== "";

export const PROVIDERS = ["discord", "google"] as const;
export type Provider = (typeof PROVIDERS)[number];

/** Provedores ligados (NEXT_PUBLIC_AUTH_PROVIDERS="discord,google"); padrão: Discord. */
export const enabledProviders: Provider[] = (process.env.NEXT_PUBLIC_AUTH_PROVIDERS ?? "discord")
  .split(",")
  .map((p) => p.trim().toLowerCase())
  .filter((p): p is Provider => (PROVIDERS as readonly string[]).includes(p));
