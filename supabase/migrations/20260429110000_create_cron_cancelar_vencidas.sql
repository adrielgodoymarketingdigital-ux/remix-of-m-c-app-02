-- Habilitar extensão pg_cron se não estiver habilitada
create extension if not exists pg_cron;

-- Criar cron job para rodar todo dia às 08h (horário de Brasília = 11h UTC)
select cron.schedule(
  'cancelar-assinaturas-vencidas',
  '0 11 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_URL') || '/functions/v1/cancelar-assinaturas-vencidas',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  );
  $$
);
