-- Permite que cada filial (empresa) tenha sua própria configuração de loja
-- (dados para impressão de recibos: nome, endereço, CNPJ, logo, layouts, etc.)
-- empresa_id = NULL representa a configuração da matriz/conta principal (comportamento atual).

ALTER TABLE public.configuracoes_loja
ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_configuracoes_loja_empresa_id ON public.configuracoes_loja(empresa_id);

-- A constraint antiga (user_id) impede mais de uma linha por usuário, mesmo de filiais
-- diferentes. Substituímos por unicidade em (user_id, empresa_id), tratando NULL como
-- um valor distinto (Postgres já trata múltiplos NULLs como não conflitantes em UNIQUE,
-- então a config "matriz" de cada usuário continua única na prática).
ALTER TABLE public.configuracoes_loja
DROP CONSTRAINT IF EXISTS configuracoes_loja_user_id_unique;

CREATE UNIQUE INDEX IF NOT EXISTS configuracoes_loja_user_empresa_unique
ON public.configuracoes_loja(user_id, empresa_id);
