-- =====================================================================
-- Marketing — Meta Ads, ETAPA 1: tabelas de cache dos insights.
--
-- Cria 2 tabelas novas com RLS ligado. Nenhuma tabela, função, tela ou
-- Edge Function existente é alterada. Nenhum dado é inserido.
--
--   meta_ads_insights_dia — uma linha por campanha por dia (cache da API de
--                           Insights da Meta, level=campaign, time_increment=1)
--   meta_ads_sync         — uma linha por conta de anúncios: quando foi a
--                           última atualização, trava e último erro
--
-- Acesso:
--   - Admin: só SELECT, via public.has_role(auth.uid(), 'admin').
--   - Escrita: nenhuma política de INSERT/UPDATE/DELETE. Só a Edge Function
--     (etapa 2), com a service role, grava. Os privilégios de escrita de
--     authenticated e todos os de anon são revogados, como defesa extra.
--   - Nenhuma coluna guarda token ou resposta bruta de erro da Meta.
--
-- Valores em dinheiro: numeric(14,2), nunca float. numeric aceita 'NaN' e
-- o Postgres considera NaN maior que qualquer número, por isso os CHECK
-- de numeric também excluem NaN.
-- Sem "atualizado_em" automático por trigger: a Edge Function grava o
-- instante do upsert.
--
-- Idempotente: CREATE ... IF NOT EXISTS; os DROP POLICY IF EXISTS atingem
-- apenas políticas destas tabelas novas.
--
-- Para reverter (não há dados de outras tabelas envolvidos):
--   BEGIN;
--   DROP TABLE IF EXISTS public.meta_ads_insights_dia;
--   DROP TABLE IF EXISTS public.meta_ads_sync;
--   COMMIT;
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1) meta_ads_insights_dia — cache por campanha e dia
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meta_ads_insights_dia (
  ad_account_id   text NOT NULL CHECK (ad_account_id ~ '^[0-9]+$'),
  campaign_id     text NOT NULL CHECK (campaign_id ~ '^[0-9]+$'),
  dia             date NOT NULL,
  campaign_name   text,
  objetivo        text,
  gasto           numeric(14,2) NOT NULL DEFAULT 0 CHECK (gasto >= 0 AND gasto <> 'NaN'),
  moeda           text CHECK (moeda ~ '^[A-Z]{3}$'),
  impressoes      bigint  CHECK (impressoes   >= 0),
  alcance         bigint  CHECK (alcance      >= 0),
  cliques         bigint  CHECK (cliques      >= 0),
  cliques_link    bigint  CHECK (cliques_link >= 0),
  leads           integer CHECK (leads        >= 0),
  cadastros       integer CHECK (cadastros    >= 0),
  compras         integer CHECK (compras      >= 0),
  valor_compras   numeric(14,2) CHECK (valor_compras >= 0 AND valor_compras <> 'NaN'),
  acoes           jsonb CHECK (acoes IS NULL OR jsonb_typeof(acoes) = 'array'),
  atualizado_em   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ad_account_id, campaign_id, dia)
);

COMMENT ON TABLE public.meta_ads_insights_dia IS
  'Cache dos insights da Meta Ads: uma linha por campanha por dia. Só a Edge Function (service role) grava; admin só lê.';
COMMENT ON COLUMN public.meta_ads_insights_dia.ad_account_id IS
  'ID numérico da conta de anúncios, sem o prefixo act_.';
COMMENT ON COLUMN public.meta_ads_insights_dia.dia IS
  'Data (date_start) no fuso da CONTA DE ANÚNCIOS, como a Meta devolve com time_increment=1.';
COMMENT ON COLUMN public.meta_ads_insights_dia.alcance IS
  'Alcance (reach) do dia. Não é somável entre dias: a mesma pessoa conta em vários dias.';
COMMENT ON COLUMN public.meta_ads_insights_dia.cliques IS
  'clicks (todos os cliques). cliques_link = inline_link_clicks.';
COMMENT ON COLUMN public.meta_ads_insights_dia.leads IS
  'action_type lead; se ausente, offsite_conversion.fb_pixel_lead (nunca os dois somados).';
COMMENT ON COLUMN public.meta_ads_insights_dia.cadastros IS
  'action_type complete_registration; se ausente, offsite_conversion.fb_pixel_complete_registration.';
COMMENT ON COLUMN public.meta_ads_insights_dia.compras IS
  'action_type purchase; se ausente, offsite_conversion.fb_pixel_purchase. valor_compras vem de action_values do mesmo tipo.';
COMMENT ON COLUMN public.meta_ads_insights_dia.acoes IS
  'Array actions bruto da Meta (action_type/value), para não perder nenhum tipo de ação.';
COMMENT ON COLUMN public.meta_ads_insights_dia.atualizado_em IS
  'Instante em que a Edge Function gravou esta linha (base da validade do cache).';

CREATE INDEX IF NOT EXISTS idx_meta_ads_insights_dia_conta_dia
  ON public.meta_ads_insights_dia (ad_account_id, dia);

-- ---------------------------------------------------------------------
-- 2) meta_ads_sync — estado da sincronização por conta
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meta_ads_sync (
  ad_account_id        text PRIMARY KEY CHECK (ad_account_id ~ '^[0-9]+$'),
  ultima_atualizacao   timestamptz,
  periodo_inicio       date,
  periodo_fim          date,
  status               text NOT NULL CHECK (status IN ('ok', 'erro', 'em_andamento')),
  erro_codigo          text,
  erro_mensagem        text CHECK (char_length(erro_mensagem) <= 300),
  em_andamento_desde   timestamptz,
  pausado_ate          timestamptz,
  uso_api_pct          numeric(5,2) CHECK (uso_api_pct >= 0 AND uso_api_pct <> 'NaN'),
  moeda                text CHECK (moeda ~ '^[A-Z]{3}$'),
  fuso                 text,
  token_expira_em      timestamptz,
  CHECK (periodo_inicio IS NULL OR periodo_fim IS NULL OR periodo_inicio <= periodo_fim),
  CHECK (status <> 'em_andamento' OR em_andamento_desde IS NOT NULL)
);

COMMENT ON TABLE public.meta_ads_sync IS
  'Estado da sincronização Meta Ads por conta de anúncios. Só a Edge Function (service role) grava; admin só lê.';
COMMENT ON COLUMN public.meta_ads_sync.ultima_atualizacao IS
  'Fim da última atualização BEM-SUCEDIDA, que cobriu periodo_inicio..periodo_fim.';
COMMENT ON COLUMN public.meta_ads_sync.erro_codigo IS
  'Código interno (ex.: token_invalido, limite_atingido), nunca o JSON da Meta.';
COMMENT ON COLUMN public.meta_ads_sync.erro_mensagem IS
  'Mensagem já traduzida para a tela (pt-BR). Nunca a resposta bruta da Meta nem o token.';
COMMENT ON COLUMN public.meta_ads_sync.em_andamento_desde IS
  'Início da ÚLTIMA tentativa (fica gravado depois que ela termina). Trava de 2 min com status em_andamento; base do intervalo mínimo de 5 min.';
COMMENT ON COLUMN public.meta_ads_sync.pausado_ate IS
  'Até quando não chamar a Meta (limite de requisições: 15 min ou estimated_time_to_regain_access).';
COMMENT ON COLUMN public.meta_ads_sync.uso_api_pct IS
  'Maior percentual lido do cabeçalho X-Business-Use-Case-Usage na última chamada.';
COMMENT ON COLUMN public.meta_ads_sync.fuso IS
  'timezone_name da conta de anúncios (ex.: America/Sao_Paulo). Define o "dia" de meta_ads_insights_dia.';
COMMENT ON COLUMN public.meta_ads_sync.token_expira_em IS
  'expires_at do /debug_token quando o token tem validade (60 dias). NULL = sem validade ou desconhecido.';

-- ---------------------------------------------------------------------
-- 3) Privilégios
-- ---------------------------------------------------------------------
REVOKE ALL ON public.meta_ads_insights_dia FROM anon;
REVOKE ALL ON public.meta_ads_sync         FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.meta_ads_insights_dia FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.meta_ads_sync         FROM authenticated;

GRANT SELECT ON public.meta_ads_insights_dia TO authenticated;
GRANT SELECT ON public.meta_ads_sync         TO authenticated;

GRANT ALL ON public.meta_ads_insights_dia TO service_role;
GRANT ALL ON public.meta_ads_sync         TO service_role;

-- ---------------------------------------------------------------------
-- 4) RLS — só admin lê; ninguém além da service role escreve
-- ---------------------------------------------------------------------
ALTER TABLE public.meta_ads_insights_dia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_ads_sync         ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin le meta_ads_insights_dia" ON public.meta_ads_insights_dia;
CREATE POLICY "admin le meta_ads_insights_dia"
  ON public.meta_ads_insights_dia FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin le meta_ads_sync" ON public.meta_ads_sync;
CREATE POLICY "admin le meta_ads_sync"
  ON public.meta_ads_sync FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

COMMIT;
