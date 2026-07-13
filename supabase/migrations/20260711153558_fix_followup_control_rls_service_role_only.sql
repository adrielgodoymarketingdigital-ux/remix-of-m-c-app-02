-- Corrige RLS em followup_control: a policy "Service role full access" foi criada
-- (20260303180121_7abcaed3-b858-4873-a4ba-05b09da5fd0d.sql) com USING(true)/WITH CHECK(true)
-- mas SEM restringir `TO service_role` — por padrão isso aplica a policy a `public`,
-- ou seja, qualquer usuário autenticado podia ler/inserir/atualizar/apagar followup_control
-- de qualquer loja, apesar do nome sugerir acesso exclusivo do service role.
--
-- followup_control é usado só pela automação de renovação de assinatura (webhook
-- pagarme-webhook, que roda com SUPABASE_SERVICE_ROLE_KEY) e pelo n8n — nenhum código
-- de frontend acessa essa tabela. service_role já ignora RLS nativamente, então
-- restringir a policy para TO service_role não quebra essa automação; só bloqueia
-- authenticated/anon, que não têm nenhum caso de uso legítimo aqui.

DROP POLICY IF EXISTS "Service role full access" ON public.followup_control;

CREATE POLICY "Service role full access"
  ON public.followup_control
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
