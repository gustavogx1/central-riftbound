# Central Riftbound

- Monorepo pnpm: `apps/web` (Next.js 16 + next-intl), `packages/core` (lógica pura), `packages/db` (Drizzle).
- Nenhum texto de interface fixo no código: tudo em `apps/web/messages/{en,pt-BR}.json`, mesmas chaves nos dois.
- Dados e imagens de cartas nunca entram no git.
- Custo zero: só recursos dos planos gratuitos (Vercel Hobby, Supabase Free, GitHub Actions, R2).
- Antes de afirmar regra ou interação do jogo, confira o texto da carta e as Core Rules.
- API da UVS: só leitura do que é público, sem login, poucas requisições.
- Antes de abrir PR: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
