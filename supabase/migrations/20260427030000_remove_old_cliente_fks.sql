-- Remove FKs originais (NO ACTION) de ordens_servico e vendas que bloqueavam exclusão de clientes.
-- As FKs corretas com ON DELETE SET NULL já existem como ordens_servico_cliente_fkey e vendas_cliente_fkey.
ALTER TABLE public.ordens_servico DROP CONSTRAINT IF EXISTS ordens_servico_cliente_id_fkey;
ALTER TABLE public.vendas DROP CONSTRAINT IF EXISTS vendas_cliente_id_fkey;
