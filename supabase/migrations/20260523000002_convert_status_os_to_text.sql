-- Converter coluna status em ordens_servico de enum para text
-- Isso permite que status customizados criados pelos usuários sejam salvos sem erro de tipo

-- 1. Adicionar coluna temporária text
ALTER TABLE ordens_servico ADD COLUMN status_text text;

-- 2. Copiar dados do enum para text
UPDATE ordens_servico SET status_text = status::text;

-- 3. Remover coluna enum antiga
ALTER TABLE ordens_servico DROP COLUMN status;

-- 4. Renomear coluna text para status
ALTER TABLE ordens_servico RENAME COLUMN status_text TO status;

-- 5. Adicionar índice para performance em queries por status
CREATE INDEX IF NOT EXISTS idx_ordens_servico_status ON ordens_servico(status);

-- 6. Verificar e ajustar políticas RLS que referenciam a coluna status
-- (as políticas existentes usam (user_id = auth.uid()) e is_funcionario_of, não filtram por status)
