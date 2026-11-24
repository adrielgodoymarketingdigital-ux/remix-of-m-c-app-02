-- =====================================================================
-- RASCUNHO — NÃO APLICADO. Técnicos ADICIONAIS da OS (fase F1, só banco).
--
-- Uma OS passa a poder ter até 4 técnicos adicionais além do principal
-- (total 5). O principal CONTINUA em ordens_servico.funcionario_id; esta
-- tabela guarda só os adicionais (mesmo desenho de os_dispositivos_adicionais).
-- os_tecnicos (técnico POR SERVIÇO, com snapshot de comissão) NÃO é tocada, e
-- a comissão NÃO muda: adicional não ganha nada por estar aqui.
--
-- Acesso (igual a os_tecnicos / os_dispositivos_adicionais, sempre pela OS-mãe):
--   dono da loja, funcionário ativo (is_funcionario_of) e gerente da filial
--   da OS. Nada para anon. Linhas não são editadas (trocar = apagar + inserir),
--   então não existe UPDATE para authenticated.
-- Regras garantidas pelo BANCO (valem também para insert direto pela API):
--   - user_id = dono da OS (policy + trava);
--   - funcionário do MESMO dono da OS e ativo no momento do vínculo
--     (policy + trava);
--   - nunca o próprio técnico principal (trava);
--   - no máximo 4 por OS (trava; a OS fica travada FOR UPDATE durante a
--     inserção, então duas gravações simultâneas não passam de 4);
--   - sem repetição (UNIQUE).
-- A trava roda como quem chama (SECURITY INVOKER): o FOR UPDATE na OS só
-- encontra a linha se o RLS de ordens_servico deixa a pessoa EDITAR a OS.
--
-- Exclusão: OS apagada de vez → linhas vão junto (CASCADE). OS na lixeira
-- (deleted_at) mantém as linhas. Funcionário EXCLUÍDO → some das OS em que era
-- adicional (CASCADE, igual a os_tecnicos); o app já orienta desativar.
--
-- Idempotente. NUNCA `supabase db push`. Rodar no SQL Editor, sozinho.
-- ANTES: scripts/os-tecnicos-adicionais/0-conferir-antes.sql
-- DEPOIS: scripts/os-tecnicos-adicionais/9-verificar.sql
-- ROLLBACK: scripts/os-tecnicos-adicionais/rollback-1-tabela.sql
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.os_tecnicos_adicionais (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id           uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id),   -- dono da loja (= ordens_servico.user_id)
  funcionario_id  uuid NOT NULL REFERENCES public.loja_funcionarios(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT os_tecnicos_adicionais_os_funcionario_key UNIQUE (os_id, funcionario_id)
);

COMMENT ON TABLE public.os_tecnicos_adicionais IS
  'Técnicos ADICIONAIS da OS (até 4). O principal continua em ordens_servico.funcionario_id. Não mexe em comissão (essa é os_tecnicos). Gravar pela função salvar_tecnicos_os.';
COMMENT ON COLUMN public.os_tecnicos_adicionais.user_id IS
  'Dono da loja; obrigatoriamente igual a ordens_servico.user_id da OS (conferido nas policies e na trava).';
COMMENT ON COLUMN public.os_tecnicos_adicionais.funcionario_id IS
  'loja_funcionarios.id (mesmo tipo de id de ordens_servico.funcionario_id); pode ser a linha "dono como funcionário".';

-- (os_id, funcionario_id) já é coberto pelo índice do UNIQUE (busca por OS).
-- funcionario_id: "Minhas OS" do técnico adicional (F3). user_id: zerar/backup.
CREATE INDEX IF NOT EXISTS idx_os_tecnicos_adicionais_funcionario_id
  ON public.os_tecnicos_adicionais (funcionario_id);
CREATE INDEX IF NOT EXISTS idx_os_tecnicos_adicionais_user_id
  ON public.os_tecnicos_adicionais (user_id);

-- ---------------------------------------------------------------------
-- Trava (BEFORE INSERT): regras que valem por qualquer caminho de gravação.
-- Códigos TA0xx no SQLSTATE para o app traduzir (F2).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.os_tecnicos_adicionais_validar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dono      uuid;
  v_principal uuid;
  v_qtd       int;
BEGIN
  -- Trava a OS: só passa quem pode EDITAR a OS (RLS de UPDATE) e serializa
  -- gravações simultâneas na mesma OS (limite de 4 confiável).
  SELECT os.user_id, os.funcionario_id
    INTO v_dono, v_principal
    FROM public.ordens_servico os
   WHERE os.id = NEW.os_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OS não encontrada ou sem permissão para editar'
      USING ERRCODE = 'TA001';
  END IF;

  IF NEW.user_id IS DISTINCT FROM v_dono THEN
    RAISE EXCEPTION 'user_id do técnico adicional tem de ser o dono da OS'
      USING ERRCODE = 'TA008';
  END IF;

  IF NEW.funcionario_id = v_principal THEN
    RAISE EXCEPTION 'O técnico principal não pode ser também técnico adicional'
      USING ERRCODE = 'TA003';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.loja_funcionarios lf
     WHERE lf.id = NEW.funcionario_id
       AND lf.loja_user_id = v_dono
       AND lf.ativo = true
  ) THEN
    RAISE EXCEPTION 'Técnico adicional não é funcionário ativo desta loja'
      USING ERRCODE = 'TA004';
  END IF;

  SELECT count(*) INTO v_qtd
    FROM public.os_tecnicos_adicionais a
   WHERE a.os_id = NEW.os_id
     AND a.funcionario_id <> NEW.funcionario_id;
  IF v_qtd >= 4 THEN
    RAISE EXCEPTION 'A OS já tem 4 técnicos adicionais (máximo)'
      USING ERRCODE = 'TA005';
  END IF;

  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION public.os_tecnicos_adicionais_validar() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS os_tecnicos_adicionais_validar ON public.os_tecnicos_adicionais;
CREATE TRIGGER os_tecnicos_adicionais_validar
  BEFORE INSERT ON public.os_tecnicos_adicionais
  FOR EACH ROW EXECUTE FUNCTION public.os_tecnicos_adicionais_validar();

-- ---------------------------------------------------------------------
-- Privilégios: a tabela nasce fechada (o padrão do Supabase daria ALL ao anon).
-- Sem UPDATE para authenticated: trocar técnico = apagar + inserir.
-- ---------------------------------------------------------------------
ALTER TABLE public.os_tecnicos_adicionais ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.os_tecnicos_adicionais FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.os_tecnicos_adicionais TO authenticated;
GRANT ALL ON public.os_tecnicos_adicionais TO service_role;

-- Dono e funcionário ativo (mesmo critério de os_tecnicos).
DROP POLICY IF EXISTS "Dono pode ver tecnicos adicionais das suas OS" ON public.os_tecnicos_adicionais;
CREATE POLICY "Dono pode ver tecnicos adicionais das suas OS"
  ON public.os_tecnicos_adicionais FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ordens_servico os
    WHERE os.id = os_tecnicos_adicionais.os_id
      AND os.user_id = os_tecnicos_adicionais.user_id
      AND (os.user_id = auth.uid() OR public.is_funcionario_of(os.user_id))
  ));

DROP POLICY IF EXISTS "Dono pode inserir tecnicos adicionais nas suas OS" ON public.os_tecnicos_adicionais;
CREATE POLICY "Dono pode inserir tecnicos adicionais nas suas OS"
  ON public.os_tecnicos_adicionais FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ordens_servico os
    JOIN public.loja_funcionarios lf
      ON lf.id = os_tecnicos_adicionais.funcionario_id
     AND lf.loja_user_id = os.user_id
    WHERE os.id = os_tecnicos_adicionais.os_id
      AND os.user_id = os_tecnicos_adicionais.user_id
      AND (os.user_id = auth.uid() OR public.is_funcionario_of(os.user_id))
  ));

DROP POLICY IF EXISTS "Dono pode deletar tecnicos adicionais das suas OS" ON public.os_tecnicos_adicionais;
CREATE POLICY "Dono pode deletar tecnicos adicionais das suas OS"
  ON public.os_tecnicos_adicionais FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ordens_servico os
    WHERE os.id = os_tecnicos_adicionais.os_id
      AND os.user_id = os_tecnicos_adicionais.user_id
      AND (os.user_id = auth.uid() OR public.is_funcionario_of(os.user_id))
  ));

-- Gerente da filial da OS (mesmo critério de os_tecnicos: empresa da OS = do gerente).
DROP POLICY IF EXISTS "gerente ve tecnicos adicionais das OS da filial" ON public.os_tecnicos_adicionais;
CREATE POLICY "gerente ve tecnicos adicionais das OS da filial"
  ON public.os_tecnicos_adicionais FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ordens_servico os
    JOIN public.empresa_usuarios eu ON eu.proprietario_id = os.user_id AND eu.empresa_id = os.empresa_id
    WHERE os.id = os_tecnicos_adicionais.os_id
      AND os.user_id = os_tecnicos_adicionais.user_id
      AND eu.gerente_id = auth.uid()
  ));

DROP POLICY IF EXISTS "gerente insere tecnicos adicionais nas OS da filial" ON public.os_tecnicos_adicionais;
CREATE POLICY "gerente insere tecnicos adicionais nas OS da filial"
  ON public.os_tecnicos_adicionais FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ordens_servico os
    JOIN public.empresa_usuarios eu ON eu.proprietario_id = os.user_id AND eu.empresa_id = os.empresa_id
    JOIN public.loja_funcionarios lf
      ON lf.id = os_tecnicos_adicionais.funcionario_id
     AND lf.loja_user_id = os.user_id
    WHERE os.id = os_tecnicos_adicionais.os_id
      AND os.user_id = os_tecnicos_adicionais.user_id
      AND eu.gerente_id = auth.uid()
  ));

DROP POLICY IF EXISTS "gerente exclui tecnicos adicionais das OS da filial" ON public.os_tecnicos_adicionais;
CREATE POLICY "gerente exclui tecnicos adicionais das OS da filial"
  ON public.os_tecnicos_adicionais FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ordens_servico os
    JOIN public.empresa_usuarios eu ON eu.proprietario_id = os.user_id AND eu.empresa_id = os.empresa_id
    WHERE os.id = os_tecnicos_adicionais.os_id
      AND os.user_id = os_tecnicos_adicionais.user_id
      AND eu.gerente_id = auth.uid()
  ));

COMMIT;
