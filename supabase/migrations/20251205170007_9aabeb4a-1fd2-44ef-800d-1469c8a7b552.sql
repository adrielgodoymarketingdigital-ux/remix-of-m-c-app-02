-- Habilitar Realtime na tabela assinaturas para propagação instantânea de mudanças
ALTER TABLE public.assinaturas REPLICA IDENTITY FULL;

-- Adicionar tabela à publicação realtime (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'assinaturas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.assinaturas;
  END IF;
END $$;