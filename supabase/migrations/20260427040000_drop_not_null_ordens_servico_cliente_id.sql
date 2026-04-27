-- Remove NOT NULL de ordens_servico.cliente_id para permitir ON DELETE SET NULL ao excluir cliente.
-- A coluna foi criada originalmente como NOT NULL mas a FK usa ON DELETE SET NULL desde 20251114.
ALTER TABLE public.ordens_servico ALTER COLUMN cliente_id DROP NOT NULL;
