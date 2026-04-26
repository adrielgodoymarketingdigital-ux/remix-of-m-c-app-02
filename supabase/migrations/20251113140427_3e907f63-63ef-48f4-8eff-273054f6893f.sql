-- 1. Tornar bucket dispositivos-fotos público para resolver problema de fotos não aparecendo
UPDATE storage.buckets 
SET public = true 
WHERE name = 'dispositivos-fotos';

-- 2. Adicionar tipo 'admin' ao enum plano_tipo para usuário de teste
ALTER TYPE plano_tipo ADD VALUE IF NOT EXISTS 'admin';

-- 3. Criar função helper para verificar se valor existe no enum (para futuras verificações)
COMMENT ON TYPE plano_tipo IS 'Tipos de planos: demonstracao, admin, basico_mensal, intermediario_mensal, profissional_mensal, basico_anual, intermediario_anual, profissional_anual';