# Central Riftbound

Projeto de fã não oficial de Riftbound: meta calculado a partir de torneios, decks, lendas, jogadores e ferramentas de deckbuilding. Inglês (`/en`) e português do Brasil (`/pt-br`).

> Não é endossado pela Riot Games. Riftbound e marcas relacionadas pertencem à Riot Games.

## Estrutura

| Pasta | O que tem |
|---|---|
| `apps/web` | Site Next.js 16 (App Router), next-intl, Tailwind 4 |
| `packages/core` | Regras e fórmulas sem framework: normalização das cartas, texto de regras com ícones |
| `packages/db` | Esquema Drizzle (Postgres), migrações e seed |
| `packages/ingest` | Importação de torneios da API pública da UVS e recálculo das estatísticas |
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

# 4. Torneios (opcional): veja a seção abaixo
pnpm track add 857745 --kind side && pnpm ingest

# 5. Site. Para ver as imagens locais: ln -s ../../../data/images apps/web/public/img
#    e NEXT_PUBLIC_IMAGE_BASE_URL=/img no .env
pnpm dev   # http://localhost:3000
```

Os dados e as imagens das cartas **não** vão para o repositório (`data/source`, `data/generated` e `data/images` estão no `.gitignore`). Só as contagens ficam em `apps/web/src/generated/catalog-summary.json`.

## Torneios

Os dados vêm da API pública (só leitura, sem login) que o localizador oficial de eventos usa. O importador faz no máximo uma requisição a cada 1,5 s, se identifica no User-Agent e pula rodadas que já foram gravadas.

```bash
pnpm suggest                       # lista RQs, Pre-RQs e Rebounds grandes
pnpm track add 857452 --kind main  # acompanha um evento (main = RQ; side = evento paralelo)
pnpm track add 857745 --kind side
pnpm ingest                        # importa os acompanhados e recalcula as estatísticas
pnpm stats                         # só recalcula
```

- A lenda de cada jogador vem do `deck_defining_card` da UVS e é casada com o catálogo pelo nome. Nomes que não casam ficam na tabela `unknown_legend_name`.
- O set (metagame) de cada evento é detectado pelo set mais novo entre as lendas usadas por pelo menos 1% dos jogadores. Para forçar: `pnpm track add <id> --metagame VEN`.
- As fórmulas estão em `packages/core/src/stats` e explicadas em `/about/methodology`.
- O workflow `Importar torneios` roda uma vez por dia quando o segredo `DATABASE_URL` existe.

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
