-- A tabela public.contas so tinha fornecedor_id (adicionado em 20260211011015),
-- sem equivalente para vincular um cliente numa conta a receber. O formulario
-- de cadastro de conta ficava preso mostrando sempre "Fornecedor", mesmo para
-- tipo = 'receber', porque nao havia onde salvar um vinculo com cliente.
ALTER TABLE public.contas ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clientes(id);
