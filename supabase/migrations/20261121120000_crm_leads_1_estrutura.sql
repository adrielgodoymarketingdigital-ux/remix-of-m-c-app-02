-- =====================================================================
-- CRM de leads do WhatsApp — FASE 1, SQL 1 de 3: ESTRUTURA.
-- Ordem e conferências: scripts/crm-leads/LEIA-ME.md
--
-- Só cria objetos NOVOS: 2 funções puras (telefone e opt-out) e 4 tabelas
-- com RLS. Nenhuma tabela existente é alterada, nenhuma FK aponta para
-- tabela existente (profiles/auth.users) e nenhum dado é inserido. Por isso
-- não há constraint NOT VALID nem lock em tabela do PDV. As tabelas do
-- Meta Ads (meta_ads_insights_dia / meta_ads_sync) NÃO são tocadas.
--
--   crm_leads              1 linha por pessoa (telefone E.164, dedupe)
--   crm_lead_mensagens     máx. 30 por lead; apagadas 90 dias após o último
--                          contato (crm_aplicar_retencao, chamada pelo n8n)
--   crm_gasto_manual       gasto informado no card (admin_crm_gasto_informar)
--   crm_campanhas_whatsapp IDs das campanhas Click-to-WhatsApp, para filtrar
--                          o gasto de meta_ads_insights_dia
--
-- Acesso: admin só lê (RLS + has_role); anon nada; authenticated não grava.
-- Gravação só pelas funções dos SQL 2 e 3.
--
-- O vínculo com o cadastro chama-se cadastro_user_id DE PROPÓSITO: é dado de
-- marketing do MecApp, não do lojista. Com o nome user_id, o "Começar do zero"
-- (zerar_meus_dados) acharia a coluna e recusaria o lojista com
-- tabela_nao_classificada. Assim _zerar_catalogo() não precisa de remendo.
--
-- Idempotente (IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS só das
-- políticas destas tabelas novas). Rollback: scripts/crm-leads/rollback-1-estrutura.sql
-- =====================================================================

BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';

-- ---------------------------------------------------------------------
-- 1) Telefone: espelho EXATO de src/lib/marketing/telefoneLead.ts e de
--    supabase/functions/crm-leads/telefone.ts (mesma lista de casos em
--    scripts/crm-leads/casos-telefone.json, testada nos três).
-- Brasil: +55 DDD número, com o 9 acrescentado em celular antigo de 8
-- dígitos (6-9). Fixo de 8 dígitos (2-5) fica como está. Fora do Brasil só
-- com "+". Qualquer outra coisa: NULL (recusado, nunca adivinhado).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crm_normalizar_telefone(p_bruto text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_txt text := btrim(coalesce(p_bruto, ''));
  v_dig text;
  v_nac text;
  v_ddd text;
  v_loc text;
BEGIN
  -- JID do WhatsApp: só "<número>[:<aparelho>]@s.whatsapp.net" ou "@c.us".
  -- Qualquer outro domínio (@lid, grupo @g.us...) NÃO é telefone: NULL.
  IF position('@' IN v_txt) > 0 THEN
    IF lower(split_part(v_txt, '@', 2)) NOT IN ('s.whatsapp.net', 'c.us') THEN RETURN NULL; END IF;
    v_txt := split_part(split_part(v_txt, '@', 1), ':', 1);
  END IF;
  v_dig := regexp_replace(v_txt, '\D', '', 'g');
  IF v_dig = '' THEN RETURN NULL; END IF;

  IF left(v_txt, 1) = '+' AND left(v_dig, 2) <> '55' THEN
    IF length(v_dig) BETWEEN 8 AND 15 AND left(v_dig, 1) <> '0' THEN
      RETURN '+' || v_dig;
    END IF;
    RETURN NULL;
  END IF;

  v_dig := ltrim(v_dig, '0');
  IF left(v_dig, 2) = '55' AND length(v_dig) IN (12, 13) THEN
    v_nac := substr(v_dig, 3);
  ELSIF length(v_dig) IN (10, 11) THEN
    v_nac := v_dig;
  ELSE
    RETURN NULL;
  END IF;

  v_ddd := left(v_nac, 2);
  v_loc := substr(v_nac, 3);
  IF v_ddd !~ '^[1-9][1-9]$' THEN RETURN NULL; END IF;

  IF length(v_loc) = 8 THEN
    IF left(v_loc, 1) IN ('6', '7', '8', '9') THEN
      v_loc := '9' || v_loc;
    ELSIF left(v_loc, 1) NOT IN ('2', '3', '4', '5') THEN
      RETURN NULL;
    END IF;
  ELSIF length(v_loc) = 9 THEN
    IF left(v_loc, 1) <> '9' THEN RETURN NULL; END IF;
  ELSE
    RETURN NULL;
  END IF;

  RETURN '+55' || v_ddd || v_loc;
END;
$$;

-- Opt-out: a mensagem INTEIRA tem que ser o pedido ("PARAR", "pare",
-- "sair", "stop"...). "Não quero parar de usar" não é opt-out.
CREATE OR REPLACE FUNCTION public.crm_eh_opt_out(p_texto text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(btrim(regexp_replace(coalesce(p_texto, ''), '[[:space:][:punct:]]+', ' ', 'g')))
         IN ('parar', 'pare', 'para', 'sair', 'stop', 'cancelar', 'descadastrar',
             'nao quero mais', 'não quero mais', 'parar mensagens', 'para de mandar');
$$;

-- ---------------------------------------------------------------------
-- 2) crm_leads
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_leads (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone_e164        text NOT NULL UNIQUE CHECK (telefone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  telefone_final8      text GENERATED ALWAYS AS (right(telefone_e164, 8)) STORED,
  telefone_ddd         text GENERATED ALWAYS AS (
                         CASE WHEN left(telefone_e164, 3) = '+55' THEN substr(telefone_e164, 4, 2) END
                       ) STORED,
  wa_jid               text CHECK (char_length(wa_jid) <= 100),
  nome                 text CHECK (char_length(nome) <= 120),

  origem_ad_id         text CHECK (origem_ad_id ~ '^[A-Za-z0-9_.-]{1,64}$'),
  origem_ad_titulo     text CHECK (char_length(origem_ad_titulo) <= 200),
  origem_ad_tipo       text CHECK (char_length(origem_ad_tipo) <= 20),
  origem_ctwa_clid     text CHECK (char_length(origem_ctwa_clid) <= 500),
  origem_url           text CHECK (char_length(origem_url) <= 500),
  origem_em            timestamptz,

  primeiro_contato_em  timestamptz NOT NULL,
  ultimo_contato_em    timestamptz NOT NULL,
  ultimo_falou         text CHECK (ultimo_falou IN ('lead', 'loja')),
  ultima_msg_lead_em   timestamptz,
  ultima_msg_loja_em   timestamptz,

  etapa                text NOT NULL DEFAULT 'novo'
                         CHECK (etapa IN ('novo', 'em_conversa', 'esfriou', 'perdido')),
  assunto              text CHECK (char_length(assunto) <= 120),
  resumo               text CHECK (char_length(resumo) <= 1500),
  resumo_em            timestamptz,

  -- Usados a partir da fase 3 (follow-up); nascem zerados.
  followups_enviados   smallint NOT NULL DEFAULT 0 CHECK (followups_enviados BETWEEN 0 AND 3),
  proximo_followup_em  timestamptz,

  opt_out              boolean NOT NULL DEFAULT false,
  opt_out_em           timestamptz,
  opt_out_origem       text CHECK (opt_out_origem IN ('mensagem_parar', 'admin', 'n8n')),

  cadastro_user_id     uuid,
  vinculo_metodo       text CHECK (vinculo_metodo IN ('cadastro_n8n', 'telefone', 'manual')),
  vinculo_em           timestamptz,
  vinculo_ambiguo      boolean NOT NULL DEFAULT false,

  mensagens_apagadas_em timestamptz,
  criado_em            timestamptz NOT NULL DEFAULT now(),
  atualizado_em        timestamptz NOT NULL DEFAULT now(),

  CHECK (opt_out = (opt_out_em IS NOT NULL)),
  CHECK ((cadastro_user_id IS NULL) = (vinculo_metodo IS NULL)),
  CHECK (primeiro_contato_em <= ultimo_contato_em)
);

COMMENT ON TABLE public.crm_leads IS
  'CRM de leads do WhatsApp (Click-to-WhatsApp). 1 linha por telefone. Só a service role grava (Edge Function crm-leads); admin só lê.';
COMMENT ON COLUMN public.crm_leads.telefone_final8 IS
  'Últimos 8 dígitos: chave de cruzamento com profiles.celular (junto com telefone_ddd), imune a 55 e nono dígito.';
COMMENT ON COLUMN public.crm_leads.wa_jid IS
  'Endereço do WhatsApp como veio do n8n (pode vir sem o nono dígito). É o usado para responder.';
COMMENT ON COLUMN public.crm_leads.etapa IS
  'Etapa da conversa. Cadastrou/em teste/assinante NÃO ficam aqui: saem do vínculo (cadastro_user_id).';
COMMENT ON COLUMN public.crm_leads.opt_out IS
  'Pediu para parar. Permanente: nenhuma função desta trilha volta para false.';

CREATE INDEX IF NOT EXISTS idx_crm_leads_ddd_final8 ON public.crm_leads (telefone_ddd, telefone_final8);
CREATE INDEX IF NOT EXISTS idx_crm_leads_cadastro_user ON public.crm_leads (cadastro_user_id) WHERE cadastro_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_leads_primeiro_contato ON public.crm_leads (primeiro_contato_em);
CREATE INDEX IF NOT EXISTS idx_crm_leads_origem_ad ON public.crm_leads (origem_ad_id) WHERE origem_ad_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_leads_ultimo_contato ON public.crm_leads (ultimo_contato_em);

-- ---------------------------------------------------------------------
-- 3) crm_lead_mensagens
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_lead_mensagens (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lead_id        uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  wa_message_id  text NOT NULL CHECK (char_length(wa_message_id) BETWEEN 1 AND 128),
  direcao        text NOT NULL CHECK (direcao IN ('entrada', 'saida')),
  autor          text NOT NULL CHECK (autor IN ('lead', 'humano', 'automacao')),
  tipo           text NOT NULL DEFAULT 'texto'
                   CHECK (tipo IN ('texto', 'audio', 'imagem', 'video', 'documento', 'figurinha', 'localizacao', 'contato', 'outro')),
  texto          text CHECK (char_length(texto) <= 2000),
  enviada_em     timestamptz NOT NULL,
  recebida_em    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_lead_mensagens_dedupe UNIQUE (lead_id, wa_message_id),
  CHECK ((direcao = 'entrada') = (autor = 'lead'))
);
COMMENT ON TABLE public.crm_lead_mensagens IS
  'Últimas mensagens do lead (máx. 30). Apagadas 90 dias após o último contato. Mídia nunca é guardada, só o tipo.';
CREATE INDEX IF NOT EXISTS idx_crm_lead_mensagens_lead_data
  ON public.crm_lead_mensagens (lead_id, enviada_em DESC);

-- ---------------------------------------------------------------------
-- 4) Gasto informado e campanhas de WhatsApp
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_gasto_manual (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  inicio       date NOT NULL,
  fim          date NOT NULL,
  ad_id        text CHECK (ad_id ~ '^[A-Za-z0-9_.-]{1,64}$'),
  descricao    text CHECK (char_length(descricao) <= 200),
  valor        numeric(14,2) NOT NULL CHECK (valor > 0 AND valor <> 'NaN'),
  moeda        text NOT NULL DEFAULT 'BRL' CHECK (moeda ~ '^[A-Z]{3}$'),
  criado_por   uuid,
  criado_em    timestamptz NOT NULL DEFAULT now(),
  removido_por uuid,
  removido_em  timestamptz,
  CHECK (inicio <= fim),
  CHECK (fim - inicio <= 400)
);
COMMENT ON TABLE public.crm_gasto_manual IS
  'Gasto de anúncios de WhatsApp informado no card do /admin/marketing (inicio..fim, inclusive; rateado por dia). ad_id NULL = gasto geral. Remoção é lógica (removido_em).';

CREATE TABLE IF NOT EXISTS public.crm_campanhas_whatsapp (
  campaign_id text PRIMARY KEY CHECK (campaign_id ~ '^[0-9]+$'),
  descricao   text CHECK (char_length(descricao) <= 200),
  criado_em   timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.crm_campanhas_whatsapp IS
  'Campanhas Click-to-WhatsApp. Só o gasto destas campanhas em meta_ads_insights_dia entra no custo do funil.';

-- ---------------------------------------------------------------------
-- 5) Privilégios e RLS (molde de 20261024130000_meta_ads_cache)
-- ---------------------------------------------------------------------
REVOKE ALL ON public.crm_leads, public.crm_lead_mensagens, public.crm_gasto_manual, public.crm_campanhas_whatsapp FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.crm_leads, public.crm_lead_mensagens, public.crm_gasto_manual, public.crm_campanhas_whatsapp FROM authenticated;
GRANT SELECT ON public.crm_leads, public.crm_lead_mensagens, public.crm_gasto_manual, public.crm_campanhas_whatsapp TO authenticated;
GRANT ALL ON public.crm_leads, public.crm_lead_mensagens, public.crm_gasto_manual, public.crm_campanhas_whatsapp TO service_role;

ALTER TABLE public.crm_leads              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_lead_mensagens     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_gasto_manual       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_campanhas_whatsapp ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin le crm_leads" ON public.crm_leads;
CREATE POLICY "admin le crm_leads" ON public.crm_leads
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admin le crm_lead_mensagens" ON public.crm_lead_mensagens;
CREATE POLICY "admin le crm_lead_mensagens" ON public.crm_lead_mensagens
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admin le crm_gasto_manual" ON public.crm_gasto_manual;
CREATE POLICY "admin le crm_gasto_manual" ON public.crm_gasto_manual
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admin le crm_campanhas_whatsapp" ON public.crm_campanhas_whatsapp;
CREATE POLICY "admin le crm_campanhas_whatsapp" ON public.crm_campanhas_whatsapp
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Funções puras: sem dado sensível, mas sem motivo para anon.
REVOKE ALL ON FUNCTION public.crm_normalizar_telefone(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.crm_eh_opt_out(text)          FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_normalizar_telefone(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_eh_opt_out(text)          TO authenticated, service_role;

COMMIT;
