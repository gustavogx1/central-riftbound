-- Ao vivo de graça: o pg_cron do Supabase chama a rota /api/cron/live-tick do site
-- a cada 2 minutos, mas só quando existe evento marcado como ao vivo. Sem evento
-- ao vivo, o job não faz requisição nenhuma.
--
-- Rodar uma vez no SQL Editor do Supabase, trocando <SITE> (ex.: central-riftbound.vercel.app) e <CRON_SECRET>
-- (o mesmo valor da variável CRON_SECRET configurada na Vercel).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- O segredo fica no Vault, não no texto do job.
select vault.create_secret('<CRON_SECRET>', 'cr_cron_secret');

select cron.schedule(
  'central-riftbound-live',
  '*/2 * * * *',
  $$
  select net.http_post(
    url := 'https://<SITE>/api/cron/live-tick',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cr_cron_secret'),
      'Content-Type', 'application/json'
    ),
    timeout_milliseconds := 290000
  )
  where exists (select 1 from public.tracked_event where live);
  $$
);

-- Para desligar: select cron.unschedule('central-riftbound-live');
