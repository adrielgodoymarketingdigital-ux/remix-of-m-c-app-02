-- !!! NÃO RODE. Só em emergência. !!!
-- Desfaz 20261125120100: remove a função salvar_tecnicos_os. Não apaga dado.
-- (O app da F2 que chamar a função passa a receber erro; reverter o app antes.)
BEGIN;
DROP FUNCTION IF EXISTS public.salvar_tecnicos_os(uuid, uuid, uuid[]);
COMMIT;
