CREATE OR REPLACE FUNCTION public.agora_servidor()
RETURNS timestamptz LANGUAGE sql STABLE SET search_path = '' AS $$ SELECT pg_catalog.now() $$;
REVOKE ALL ON FUNCTION public.agora_servidor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agora_servidor() TO authenticated;

CREATE OR REPLACE FUNCTION public.caixas_fechamento_hora_servidor()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.data_fechamento := pg_catalog.now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_caixas_fechamento_hora_servidor ON public.caixas;
CREATE TRIGGER trg_caixas_fechamento_hora_servidor
  BEFORE UPDATE OF status ON public.caixas
  FOR EACH ROW
  WHEN (OLD.status = 'aberto' AND NEW.status = 'fechado')
  EXECUTE FUNCTION public.caixas_fechamento_hora_servidor();

NOTIFY pgrst, 'reload schema';
