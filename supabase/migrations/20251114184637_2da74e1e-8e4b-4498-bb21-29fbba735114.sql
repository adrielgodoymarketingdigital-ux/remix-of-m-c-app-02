-- ===== MIGRAÇÃO: Corrigir constraints de fornecedores =====
-- Remove constraints globais e adiciona constraints por usuário

-- STEP 1: Remover constraints UNIQUE globais existentes
ALTER TABLE fornecedores DROP CONSTRAINT IF EXISTS fornecedores_cnpj_key;
ALTER TABLE fornecedores DROP CONSTRAINT IF EXISTS fornecedores_cpf_key;

-- STEP 2: Adicionar índices únicos compostos (user_id + cnpj/cpf)
-- Isso permite que diferentes usuários cadastrem o mesmo CNPJ/CPF
-- mas previne duplicatas dentro dos dados de cada usuário
CREATE UNIQUE INDEX IF NOT EXISTS fornecedores_user_cnpj_unique 
ON fornecedores (user_id, cnpj) 
WHERE cnpj IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS fornecedores_user_cpf_unique 
ON fornecedores (user_id, cpf) 
WHERE cpf IS NOT NULL;

-- STEP 3: Comentários explicativos
COMMENT ON INDEX fornecedores_user_cnpj_unique IS 
'Garante que cada usuário pode ter apenas um fornecedor com o mesmo CNPJ';

COMMENT ON INDEX fornecedores_user_cpf_unique IS 
'Garante que cada usuário pode ter apenas um fornecedor com o mesmo CPF';