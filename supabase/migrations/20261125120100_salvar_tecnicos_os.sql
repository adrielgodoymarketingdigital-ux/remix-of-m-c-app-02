-- =====================================================================
-- RASCUNHO — NÃO APLICADO. Função de gravação atômica dos técnicos da OS.
-- Depende de 20261125120000_os_tecnicos_adicionais.sql (rodar antes).
--
-- salvar_tecnicos_os(p_ordem_id, p_principal, p_adicionais) numa ÚNICA
-- transação (a chamada RPC já é uma transação):
--   1. confere as entradas: principal obrigatório, sem nulos, sem repetidos,
--      adicional ≠ principal, no máximo 4 adicionais;
--   2. trava a OS (FOR UPDATE): só encontra a OS quem pode EDITÁ-LA pelo RLS
--      de ordens_servico (dono, funcionário ativo, gerente da filial); OS na
--      lixeira é recusada; gravações simultâneas na mesma OS viram fila;
--   3. confere que principal e adicionais NOVOS são funcionários ativos do
--      dono da OS (os que já estavam ficam, mesmo se desativados depois);
--   4. apaga os adicionais que saíram → grava o principal (só se mudou, para
--      não gerar linha à toa no os_audit_log) → insere só os novos.
--   Como é uma transação só, ninguém enxerga a OS "sem técnicos" no meio.
--
-- SECURITY INVOKER (de propósito): tudo passa pelo RLS que já existe
-- (ordens_servico, loja_funcionarios, os_tecnicos_adicionais). Não há regra
-- de permissão copiada aqui dentro que possa divergir das policies no futuro,
-- e não há como um funcionário ganhar mais acesso do que já tem. As regras de
-- negócio que não dependem de quem chama ficam também na trava da tabela.
--
-- Retorno: jsonb {os_id, principal, adicionais[], inseridos, removidos,
--                 principal_alterado}.
-- Erros (SQLSTATE): TA001 OS não encontrada/sem permissão; TA002 principal
-- ausente; TA003 adicional = principal; TA004 não é funcionário (ativo) da
-- loja; TA005 mais de 4; TA006 repetido/nulo; TA007 principal inativo.
--
-- Só authenticated executa (nada para anon/PUBLIC).
-- ROLLBACK: scripts/os-tecnicos-adicionais/rollback-2-funcao.sql
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.salvar_tecnicos_os(
  p_ordem_id   uuid,
  p_principal  uuid,
  p_adicionais uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_adic            uuid[] := COALESCE(p_adicionais, '{}'::uuid[]);
  v_dono            uuid;
  v_principal_atual uuid;
  v_ativo           boolean;
  v_invalido        uuid;
  v_removidos       int := 0;
  v_inseridos       int := 0;
  v_principal_mudou boolean := false;
BEGIN
  -- 1. Entradas
  IF p_ordem_id IS NULL THEN
    RAISE EXCEPTION 'OS não informada' USING ERRCODE = 'TA001';
  END IF;
  IF p_principal IS NULL THEN
    RAISE EXCEPTION 'O técnico principal é obrigatório' USING ERRCODE = 'TA002';
  END IF;
  IF array_position(v_adic, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Lista de técnicos adicionais com item vazio' USING ERRCODE = 'TA006';
  END IF;
  IF (SELECT count(DISTINCT x) FROM unnest(v_adic) x) <> cardinality(v_adic) THEN
    RAISE EXCEPTION 'Técnico adicional repetido' USING ERRCODE = 'TA006';
  END IF;
  IF p_principal = ANY (v_adic) THEN
    RAISE EXCEPTION 'O técnico principal não pode ser também técnico adicional' USING ERRCODE = 'TA003';
  END IF;
  IF cardinality(v_adic) > 4 THEN
    RAISE EXCEPTION 'No máximo 4 técnicos adicionais (recebidos %)', cardinality(v_adic) USING ERRCODE = 'TA005';
  END IF;

  -- 2. Trava a OS (RLS de SELECT + UPDATE de ordens_servico decide quem passa)
  SELECT os.user_id, os.funcionario_id
    INTO v_dono, v_principal_atual
    FROM public.ordens_servico os
   WHERE os.id = p_ordem_id
     AND os.deleted_at IS NULL
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OS não encontrada ou sem permissão para editar' USING ERRCODE = 'TA001';
  END IF;

  -- 3. Principal: funcionário do dono da OS; ativo se estiver sendo trocado
  SELECT lf.ativo INTO v_ativo
    FROM public.loja_funcionarios lf
   WHERE lf.id = p_principal
     AND lf.loja_user_id = v_dono;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Técnico principal não é funcionário desta loja' USING ERRCODE = 'TA004';
  END IF;
  v_principal_mudou := p_principal IS DISTINCT FROM v_principal_atual;
  IF v_principal_mudou AND NOT v_ativo THEN
    RAISE EXCEPTION 'Técnico principal está desativado' USING ERRCODE = 'TA007';
  END IF;

  --    Adicionais NOVOS: funcionário ativo do dono da OS
  SELECT x INTO v_invalido
    FROM unnest(v_adic) x
   WHERE NOT EXISTS (SELECT 1 FROM public.os_tecnicos_adicionais a
                      WHERE a.os_id = p_ordem_id AND a.funcionario_id = x)
     AND NOT EXISTS (SELECT 1 FROM public.loja_funcionarios lf
                      WHERE lf.id = x AND lf.loja_user_id = v_dono AND lf.ativo = true)
   LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Técnico adicional % não é funcionário ativo desta loja', v_invalido USING ERRCODE = 'TA004';
  END IF;

  -- 4. Troca o conjunto: sai → principal → entra
  DELETE FROM public.os_tecnicos_adicionais a
   WHERE a.os_id = p_ordem_id
     AND NOT (a.funcionario_id = ANY (v_adic));
  GET DIAGNOSTICS v_removidos = ROW_COUNT;

  IF v_principal_mudou THEN
    UPDATE public.ordens_servico
       SET funcionario_id = p_principal
     WHERE id = p_ordem_id;
  END IF;

  INSERT INTO public.os_tecnicos_adicionais (os_id, user_id, funcionario_id)
  SELECT p_ordem_id, v_dono, x
    FROM unnest(v_adic) WITH ORDINALITY AS t(x, n)
   WHERE NOT EXISTS (SELECT 1 FROM public.os_tecnicos_adicionais a
                      WHERE a.os_id = p_ordem_id AND a.funcionario_id = t.x)
   ORDER BY t.n;
  GET DIAGNOSTICS v_inseridos = ROW_COUNT;

  RETURN jsonb_build_object(
    'os_id',              p_ordem_id,
    'principal',          p_principal,
    'adicionais',         to_jsonb(v_adic),
    'inseridos',          v_inseridos,
    'removidos',          v_removidos,
    'principal_alterado', v_principal_mudou
  );
END
$$;

COMMENT ON FUNCTION public.salvar_tecnicos_os(uuid, uuid, uuid[]) IS
  'Grava técnico principal (ordens_servico.funcionario_id) + até 4 adicionais (os_tecnicos_adicionais) numa transação. SECURITY INVOKER: permissões = RLS em vigor. Não mexe em os_tecnicos/comissão.';

REVOKE ALL ON FUNCTION public.salvar_tecnicos_os(uuid, uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_tecnicos_os(uuid, uuid, uuid[]) TO authenticated;

COMMIT;
