-- !!! NÃO RODE. Só em emergência. !!!
-- Desfaz 20261125120000. APAGA TODOS OS TÉCNICOS ADICIONAIS GRAVADOS (sem volta).
-- Ordem obrigatória: rollback-3 → rollback-2 → este.
-- Recusa se o catálogo do "Começar do zero" ainda cita a tabela.
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public._zerar_catalogo() c WHERE c.tabela = 'public.os_tecnicos_adicionais') THEN
    RAISE EXCEPTION 'rode rollback-3-zerar-catalogo.sql antes';
  END IF;
  IF to_regprocedure('public.salvar_tecnicos_os(uuid,uuid,uuid[])') IS NOT NULL THEN
    RAISE EXCEPTION 'rode rollback-2-funcao.sql antes';
  END IF;
END $$;
DROP TABLE IF EXISTS public.os_tecnicos_adicionais;               -- leva trigger, policies e índices
DROP FUNCTION IF EXISTS public.os_tecnicos_adicionais_validar();
COMMIT;
