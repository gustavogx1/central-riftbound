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

## Decklists do TopDeck.gg

Os Showdowns e outros eventos grandes usam o TopDeck.gg para inscrição e decklist. O `pnpm topdeck` (no workflow diário, depois do `pnpm ingest`) busca pela [API oficial](https://topdeck.gg/docs/tournaments-v2) os torneios de Riftbound construído terminados com 128+ jogadores e nome de evento grande (Showdown, Regional, Qualifier, Summit, prêmio em dinheiro…), sem grinders, paralelos e limitados.

```bash
pnpm topdeck                     # terminados nos últimos 30 dias, só os novos
pnpm topdeck --since 2025-10-01  # primeira carga
pnpm topdeck --dry-run           # só lista o que entraria
pnpm topdeck --force             # reimporta os já importados
pnpm topdeck <tid>               # um torneio específico
```

- **Sem duplicar:** quando o mesmo evento já veio da UVS (até 36 h de diferença e até 20% de diferença no público, o nome desempata), ele só ganha as decklists, ligadas aos jogadores da UVS pelo nome ("Nam Dang" ↔ "Nam D" ou o nick), com a lenda e a colocação para desempatar. Quem não casa com certeza fica com a decklist, sem link de jogador.
- **Evento só no TopDeck:** entra inteiro (rodadas, partidas, classificação) com ids negativos (`topdeck_ref`), e conta nas estatísticas. Se depois aparecer na UVS, sai e vira só decklist.
- Correções à mão em `packages/ingest/topdeck-events.json`: `ignore` (tids que nunca entram) e `link` (tid → id do evento na UVS).
- Cada decklist vira código de deck (`event_deck.code`); linhas não reconhecidas ficam em `unknown`. Páginas: aba Decklists em `/events/[id]`, `/events/[id]/decks/[jogador]` e "Decklists de torneio" na página da lenda.
- Termos do TopDeck: crédito com link para o TopDeck.gg em toda página que mostra esses dados (já está lá), nada de vender os dados, e o nome segue o TopDeck (inclusive "Deleted User").
- Precisa do segredo `TOPDECK_API_KEY` (chave grátis em topdeck.gg). Sem ele o passo só avisa e segue.

## Jogadores

`/players` busca pelo nome público dos eventos oficiais; `/players/[id]` mostra eventos, lendas, partidas recentes e adversários mais enfrentados; `/players/[id]/vs/[outro]` é o confronto direto. Jogador com `hidden = true` não aparece em lugar nenhum.

## Deckbuilder e busca

- `/builder`: deckbuilder com validação na hora (Core Rules 103 e Tournament Rules 402/601: lenda, campeão escolhido com a tag da lenda, 40 cartas, até 3 cópias por nome, [Unique], Signature, identidade de domínio, 12 runas, 3 campos de nomes diferentes, sideboard até 10, banidas do Constructed). O rascunho fica no `localStorage` do navegador.
- Códigos de deck no formato aberto do Piltover Archive (`@piltoverarchive/riftbound-deck-codes`, Apache-2.0), lista em texto, link `?code=`, `.txt` e folha de inscrição para imprimir ou salvar em PDF (`/builder/print`).
- `/cards/[código]` (qualquer impressão, ex.: `OGN-007a`): texto, impressões e uso nas decklists de torneio por lenda, com as listas recentes que usam a carta. Os nomes das cartas nas listas e nas estatísticas levam para cá.
- `/cards` aceita sintaxe (`t:unit d:fury c<=3 o:"draw" -is:signature`, `or`); a ajuda fica em `/cards/syntax`. A mesma busca roda no deckbuilder.
- Regras e banidas ficam em `packages/core/src/deck/rules.ts`, com a fonte de cada número.

## Contas, decks salvos e votos

- Login pelo Supabase Auth (Discord e/ou Google, em `NEXT_PUBLIC_AUTH_PROVIDERS`). Sem `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` o site roda igual, sem o botão de entrar.
- As páginas continuam estáticas: o cabeçalho pergunta quem está logado em `/api/me`. O `proxy.ts` só renova a sessão de quem já tem cookie do Supabase.
- Tabelas `profile`, `user_deck` e `complexity_vote`. O site grava nelas só pelo servidor, que relê o código do deck e confere dono, limites (200 decks por conta) e validade.
- **RLS ligado em todas as tabelas** (migração 0005), sem políticas: a API pública do Supabase não lê nem grava nada. Tabela nova precisa de `ENABLE ROW LEVEL SECURITY` na migração.
- `/decks` lista decks públicos e válidos; `/decks/[id]` mostra o deck (privado só para o dono, não listado só com o link); `/account` tem os decks e o nome de exibição.
- Complexidade: voto 1–5 por lenda e por set na página da lenda. No gráfico do meta, a lenda aparece no eixo de complexidade com 10+ votos (média puxada para 3 com poucos votos).

## Decklists da comunidade e estatísticas por carta

- `/events/[id]/submit` (evento terminado, usuário logado): a pessoa acha o jogador na classificação final, cola a lista (código de deck ou texto, ou escolhe um deck salvo) e pode pôr o link de onde a lista foi publicada. O servidor confere: jogador na classificação, lista válida para torneio (banidas depois do evento não barram), **lenda igual à registrada na UVS** e jogador sem lista publicada.
- O envio entra como pendente (tabela `deck_submission`, migração 0007; até 20 pendentes por conta). Quem enviou vê a prévia e acompanha em `/account`.
- Moderação em `/admin` para os e-mails em `ADMIN_EMAILS` (variável na Vercel): aprovar, recusar com motivo ou tirar do ar. Envio de moderador já entra aprovado (listas publicadas por organizadores, com o link da fonte). Uma lista aprovada por jogador e evento; se o TopDeck trouxer a lista do mesmo jogador, vale a do TopDeck.
- Listas aprovadas aparecem junto com as do TopDeck: aba Decklists do evento, `/events/[id]/decks/cr-<id>` e "Decklists de torneio" da lenda.
- **Estatísticas por carta** na página da lenda (set escolhido): em quantas listas a carta está, cópias médias, staples (75%+) e win rate de quem jogou com ela (30+ partidas). **Tempero** (0–100) nas páginas de deck: quanto a lista foge das outras listas de torneio da lenda (mínimo de 5). Fórmulas em `packages/core/src/stats/cards.ts`.

## Colocar no ar

Tudo em plano grátis e sem cartão: Supabase (banco e Storage das imagens) e Vercel Hobby (site).

1. Segredos do GitHub Actions: `DATABASE_URL` (Session pooler do Supabase), `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.
2. Rode o workflow **Montar o banco e as imagens** (`setup.yml`): baixa as cartas da galeria oficial com `scripts/scrape_cards.py`, cria as tabelas, envia as WebP para o bucket público `cards` (`pnpm upload:images`), cadastra os eventos de `packages/ingest/tracked-events.json` (`pnpm track seed`) e importa tudo. Os dados só passam pelo runner; nada entra no git.
3. Vercel com Root Directory `apps/web` e as variáveis `DATABASE_URL` (Transaction pooler), `NEXT_PUBLIC_IMAGE_BASE_URL` (`<SUPABASE_URL>/storage/v1/object/public/cards`) e `CRON_SECRET`.
4. No SQL Editor do Supabase, rode `supabase/live-cron.sql` uma vez.
5. Login (opcional): crie os apps OAuth do Discord e do Google com o callback `https://<ref>.supabase.co/auth/v1/callback`, ligue os provedores em Authentication → Sign In / Providers, ponha o endereço do site em URL Configuration (Site URL e Redirect URL `https://<site>/api/auth/callback`) e adicione na Vercel `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `NEXT_PUBLIC_AUTH_PROVIDERS=discord,google`.

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
| `pnpm topdeck` | Decklists e eventos grandes do TopDeck.gg |
| `pnpm record` / `pnpm simulate` | Grava um evento e o reproduz como ao vivo |

## Custo

Tudo foi pensado para os planos gratuitos: Vercel Hobby, Supabase Free (banco e Storage) e GitHub Actions. O Cloudflare R2 ficou de fora porque pede cartão para ativar. Ver o plano completo do projeto para os limites.
