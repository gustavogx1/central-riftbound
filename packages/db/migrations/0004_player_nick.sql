-- Idempotente: o banco de produção recebeu estas colunas por uma versão anterior
-- desta migração (numerada 0003), aplicada antes da 0003_showdown. Como o migrador
-- pula migrações mais antigas que a última aplicada, a 0003_showdown não rodaria
-- lá; o ADD VALUE abaixo cobre esse caso e não faz nada onde ela já rodou.
ALTER TYPE "public"."event_kind" ADD VALUE IF NOT EXISTS 'showdown';--> statement-breakpoint
ALTER TABLE "player" ADD COLUMN IF NOT EXISTS "nick" text;--> statement-breakpoint
ALTER TABLE "player" ADD COLUMN IF NOT EXISTS "nick_at" timestamp with time zone;
