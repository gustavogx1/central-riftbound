# Central Riftbound

Projeto de fã não oficial de Riftbound: meta calculado a partir de torneios, decks, lendas, jogadores e ferramentas de deckbuilding. Inglês (`/en`) e português do Brasil (`/pt-br`).

> Não é endossado pela Riot Games. Riftbound e marcas relacionadas pertencem à Riot Games.

## Estrutura

| Pasta | O que tem |
|---|---|
| `apps/web` | Site Next.js 16 (App Router), next-intl, Tailwind 4 |
| `packages/core` | Regras e fórmulas sem framework: normalização das cartas, texto de regras com ícones |
| `packages/db` | Esquema Drizzle (Postgres), migrações e seed |
| `scripts` | Importação de cartas e geração de imagens WebP |

## Rodar localmente

Requisitos: Node 22 e pnpm 10.

```bash
pnpm install
cp .env.example .env

# 1. Cartas: aponte para o cards.json da galeria oficial
pnpm import:cards caminho/para/riftbound/cards.json

# 2. Banco (Docker ou Supabase)
docker compose up -d
pnpm db:migrate
pnpm db:seed

# 3. Imagens (opcional nesta fase): PNG → WebP 372/744 + avatar das lendas
pnpm build:images caminho/para/riftbound/imagens

# 4. Site
pnpm dev   # http://localhost:3000
```

Os dados e as imagens das cartas **não** vão para o repositório (`data/source`, `data/generated` e `data/images` estão no `.gitignore`). Só as contagens ficam em `apps/web/src/generated/catalog-summary.json`.

## Idiomas

Todo texto de interface fica em `apps/web/messages/en.json` e `pt-BR.json`. O teste `messages.test.ts` falha se faltar uma chave ou um placeholder em qualquer idioma.

## Comandos

| Comando | O que faz |
|---|---|
| `pnpm typecheck` | TypeScript em todos os pacotes |
| `pnpm lint` | ESLint do site |
| `pnpm test` | Vitest em todos os pacotes |
| `pnpm build` | Build de produção do site |
| `pnpm db:generate` | Gera migração a partir do esquema |

## Custo

Tudo foi pensado para os planos gratuitos: Vercel Hobby, Supabase Free, GitHub Actions e Cloudflare R2. Ver o plano completo do projeto para os limites.
