-- Rollback manual da migration 20261118120000_caixa_hora_servidor.sql.
-- Rodar no SQL Editor só se for preciso desfazer. O app continua funcionando sem estes objetos.
DROP TRIGGER IF EXISTS trg_caixas_fechamento_hora_servidor ON public.caixas;
DROP FUNCTION IF EXISTS public.caixas_fechamento_hora_servidor();
DROP FUNCTION IF EXISTS public.agora_servidor();
NOTIFY pgrst, 'reload schema';
