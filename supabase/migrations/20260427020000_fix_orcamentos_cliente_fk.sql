-- Corrige FK de orcamentos para cliente: ao excluir cliente, seta NULL em vez de bloquear
ALTER TABLE public.orcamentos
DROP CONSTRAINT IF EXISTS orcamentos_cliente_id_fkey;

ALTER TABLE public.orcamentos
ADD CONSTRAINT orcamentos_cliente_id_fkey
FOREIGN KEY (cliente_id)
REFERENCES public.clientes(id)
ON DELETE SET NULL;
