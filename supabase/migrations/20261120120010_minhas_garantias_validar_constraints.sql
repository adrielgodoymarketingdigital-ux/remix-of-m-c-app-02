-- =====================================================================
-- "Minhas garantias" — FASE A: VALIDAR as constraints criadas NOT VALID
-- Roda DEPOIS de 20261120120000_minhas_garantias_estrutura.sql (pode ser em
-- outro horário). Quem aplica é o Adriel, no SQL Editor. NUNCA `db push`.
--
-- VALIDATE CONSTRAINT varre vendas/dispositivos conferindo as linhas que já
-- existem (todas com as colunas novas nulas: passam). Lock LEVE:
--   - na tabela validada: SHARE UPDATE EXCLUSIVE → SELECT, INSERT, UPDATE e
--     DELETE seguem normalmente (o PDV não para); só bloqueia outro DDL/VACUUM;
--   - nas tabelas referenciadas (garantias_*): ROW SHARE.
-- lock_timeout 5 s (falha sem efeito se algum DDL estiver rodando) e
-- statement_timeout 10 min (é uma varredura da tabela inteira).
-- Idempotente: constraint já validada é pulada. Não altera nenhum dado.
-- DEPOIS: scripts/minhas-garantias/1b-verificar-validacao-indices.sql.
-- Não tem rollback próprio: validar só marca a constraint como conferida.
-- =====================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '10min';

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conrelid::regclass AS tabela, c.conname
    FROM pg_constraint c
    WHERE c.conrelid IN ('public.vendas'::regclass, 'public.dispositivos'::regclass)
      AND c.conname IN ('vendas_garantia_id_fkey', 'vendas_garantia_texto_id_fkey', 'vendas_garantia_meses_check',
                        'vendas_garantia_nome_check', 'vendas_garantia_copia_check', 'dispositivos_garantia_padrao_id_fkey')
      AND NOT c.convalidated
    ORDER BY c.conname
  LOOP
    EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I', r.tabela, r.conname);
  END LOOP;
END
$$;

-- Autoverificação: as 6 existem e estão validadas.
DO $$
DECLARE v_validadas int;
BEGIN
  SELECT count(*) INTO v_validadas FROM pg_constraint
   WHERE conname IN ('vendas_garantia_id_fkey', 'vendas_garantia_texto_id_fkey', 'vendas_garantia_meses_check',
                     'vendas_garantia_nome_check', 'vendas_garantia_copia_check', 'dispositivos_garantia_padrao_id_fkey')
     AND convalidated;
  IF v_validadas <> 6 THEN
    RAISE EXCEPTION 'minhas garantias (validar): % de 6 constraints validadas', v_validadas;
  END IF;
END
$$;

COMMIT;
