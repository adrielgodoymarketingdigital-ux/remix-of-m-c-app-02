-- Cron: reverter liberações temporárias vencidas — a cada 10 minutos.
-- Totalmente separado de 'cancelar-assinaturas-vencidas' (cadência e
-- semântica diferentes: sem carência, restaura snapshot).
--
-- NOTA: este projeto NÃO usa vault para os secrets do cron. Os jobs que
-- rodam em produção (backup-diario, cancelar-assinaturas-vencidas) têm a
-- URL e o Bearer de service role hardcoded. Seguimos o mesmo formato aqui.
--
-- O <SERVICE_ROLE_KEY> abaixo NÃO fica versionado. Ao aplicar, substitua pelo
-- mesmo Bearer usado nos jobs backup-diario / cancelar-assinaturas-vencidas
-- (visível em `select command from cron.job`). O job real já está aplicado em
-- produção (jobid 5) com o token correto.
create extension if not exists pg_cron;

select cron.unschedule('reverter-liberacoes-temporarias')
where exists (select 1 from cron.job where jobname = 'reverter-liberacoes-temporarias');

select cron.schedule(
  'reverter-liberacoes-temporarias',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://qztuzcchknptrvkdmdph.supabase.co/functions/v1/reverter-liberacoes-temporarias',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);
