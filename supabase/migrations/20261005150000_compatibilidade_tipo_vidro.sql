-- Compatibilidade de Vidros (troca de vidro da tela) na mesma base da
-- Compatibilidade de Película: coluna "tipo" no grupo ('pelicula' | 'vidro').
-- Os modelos (grupo_compatibilidade_modelos) herdam o tipo pelo grupo_id.
--
-- IMPACTO:
-- - Todas as linhas existentes de grupos_compatibilidade_pelicula recebem
--   tipo = 'pelicula' (DEFAULT); nenhum outro valor é alterado e nenhuma linha
--   é inserida ou apagada. Em grupo_compatibilidade_modelos nada muda.
-- - RLS: as policies existentes continuam valendo como estão (leitura para
--   autenticados, escrita só admin do MecApp) — valem para os dois tipos.
-- - Front antigo (sem filtro de tipo) continua funcionando: ignora a coluna.
--   Enquanto não houver grupos de vidro, ele mostra exatamente o mesmo de hoje.
-- - Os dados de vidro NÃO entram aqui: scripts/seed_compatibilidade_vidro.sql,
--   aplicado à mão depois desta migration e do front novo publicado.
-- - Idempotente: pode rodar mais de uma vez.

ALTER TABLE public.grupos_compatibilidade_pelicula
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'pelicula';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'grupos_compatibilidade_pelicula_tipo_check'
      AND conrelid = 'public.grupos_compatibilidade_pelicula'::regclass
  ) THEN
    ALTER TABLE public.grupos_compatibilidade_pelicula
      ADD CONSTRAINT grupos_compatibilidade_pelicula_tipo_check CHECK (tipo IN ('pelicula', 'vidro'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_grupos_compatibilidade_pelicula_tipo
  ON public.grupos_compatibilidade_pelicula(tipo);
