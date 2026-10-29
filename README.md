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

## Ao vivo

Durante um evento marcado como ao vivo, o site busca a rodada atual a cada 2 minutos (pairings, resultados, standings parciais e o relógio da rodada). A página do evento consulta um "pulso" guardado 15 s no cache da CDN e só recarrega quando algo muda, então mil pessoas olhando custam o mesmo que uma.

```bash
pnpm track add 857452 --kind main --live   # acompanha e já liga o ao vivo
pnpm track live 857452 on|off              # liga ou desliga à mão
pnpm live                                  # uma passada (o que o agendamento chama)
pnpm live --watch                          # repete a cada 60 s até o evento acabar (rodar do seu PC)
pnpm live --arm                            # liga o ao vivo dos acompanhados que começam em até 36 h
```

- O ao vivo desliga sozinho quando a UVS marca o evento como terminado (e aí as estatísticas são recalculadas), ou 3 dias depois do início. Antes de faltar 30 min para o início, nenhuma requisição é feita.
- Agendamento gratuito: na Vercel, defina `CRON_SECRET`; no Supabase, rode `supabase/live-cron.sql` uma vez. O pg_cron chama `/api/cron/live-tick` a cada 2 min só enquanto houver evento ao vivo. O workflow diário roda `pnpm live --arm`.
- Standings de rodada em andamento aparecem como não oficiais; ficam finais quando a rodada fecha.

### Simulador

Para testar sem esperar um campeonato, grave um evento terminado e reproduza-o como se fosse ao vivo:

```bash
pnpm record 1233873                                        # grava em data/recordings/ (fora do git)
pnpm simulate data/recordings/1233873.json --step 30       # API falsa em localhost:8787; 4 passos por rodada
UVS_BASE_URL=http://localhost:8787 UVS_MIN_INTERVAL_MS=0 pnpm live --watch --every 10
```

Cada rodada passa por quatro passos: pairings saem, metade dos resultados, todos os resultados, rodada fechada.

## Jogadores

`/players` busca pelo nome público dos eventos oficiais; `/players/[id]` mostra eventos, lendas, partidas recentes e adversários mais enfrentados; `/players/[id]/vs/[outro]` é o confronto direto. Jogador com `hidden = true` não aparece em lugar nenhum.

## Deckbuilder e busca

- `/builder`: deckbuilder com validação na hora (Core Rules 103 e Tournament Rules 402/601: lenda, campeão escolhido com a tag da lenda, 40 cartas, até 3 cópias por nome, [Unique], Signature, identidade de domínio, 12 runas, 3 campos de nomes diferentes, sideboard até 10, banidas do Constructed). O rascunho fica no `localStorage` do navegador.
- Códigos de deck no formato aberto do Piltover Archive (`@piltoverarchive/riftbound-deck-codes`, Apache-2.0), lista em texto, link `?code=`, `.txt` e folha de inscrição para imprimir ou salvar em PDF (`/builder/print`).
- `/cards` aceita sintaxe (`t:unit d:fury c<=3 o:"draw" -is:signature`, `or`); a ajuda fica em `/cards/syntax`. A mesma busca roda no deckbuilder.
- Regras e banidas ficam em `packages/core/src/deck/rules.ts`, com a fonte de cada número.

## Colocar no ar

Tudo em plano grátis e sem cartão: Supabase (banco e Storage das imagens) e Vercel Hobby (site).

1. Segredos do GitHub Actions: `DATABASE_URL` (Session pooler do Supabase), `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.
2. Rode o workflow **Montar o banco e as imagens** (`setup.yml`): baixa as cartas da galeria oficial com `scripts/scrape_cards.py`, cria as tabelas, envia as WebP para o bucket público `cards` (`pnpm upload:images`), cadastra os eventos de `packages/ingest/tracked-events.json` (`pnpm track seed`) e importa tudo. Os dados só passam pelo runner; nada entra no git.
3. Vercel com Root Directory `apps/web` e as variáveis `DATABASE_URL` (Transaction pooler), `NEXT_PUBLIC_IMAGE_BASE_URL` (`<SUPABASE_URL>/storage/v1/object/public/cards`) e `CRON_SECRET`.
4. No SQL Editor do Supabase, rode `supabase/live-cron.sql` uma vez.

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
| `pnpm live` | Atualiza os eventos ao vivo |
| `pnpm record` / `pnpm simulate` | Grava um evento e o reproduz como ao vivo |

## Custo

Tudo foi pensado para os planos gratuitos: Vercel Hobby, Supabase Free (banco e Storage) e GitHub Actions. O Cloudflare R2 ficou de fora porque pede cartão para ativar. Ver o plano completo do projeto para os limites.
