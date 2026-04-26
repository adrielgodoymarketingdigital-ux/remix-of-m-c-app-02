
ALTER TABLE public.loja_funcionarios ADD COLUMN IF NOT EXISTS comissao_escopo TEXT DEFAULT NULL;

COMMENT ON COLUMN public.loja_funcionarios.comissao_escopo IS 'Escopo da comissão: vendas_produtos, vendas_dispositivos, vendas_todos, servicos_os, tudo';
