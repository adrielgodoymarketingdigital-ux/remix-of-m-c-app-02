-- ===== MIGRAÇÃO: Adicionar foreign keys para clientes =====
-- Adiciona constraints ON DELETE SET NULL para manter integridade referencial
-- Isso permite que ordens de serviço e vendas mantenham seu histórico
-- mesmo quando o cliente for excluído

-- STEP 1: Adicionar foreign key na tabela ordens_servico
ALTER TABLE ordens_servico 
ADD CONSTRAINT ordens_servico_cliente_fkey 
FOREIGN KEY (cliente_id) 
REFERENCES clientes(id) 
ON DELETE SET NULL;

-- STEP 2: Adicionar foreign key na tabela vendas
ALTER TABLE vendas 
ADD CONSTRAINT vendas_cliente_fkey 
FOREIGN KEY (cliente_id) 
REFERENCES clientes(id) 
ON DELETE SET NULL;

-- STEP 3: Comentários explicativos
COMMENT ON CONSTRAINT ordens_servico_cliente_fkey ON ordens_servico IS 
'Quando cliente for excluído, cliente_id é definido como NULL mas a ordem é mantida';

COMMENT ON CONSTRAINT vendas_cliente_fkey ON vendas IS 
'Quando cliente for excluído, cliente_id é definido como NULL mas a venda é mantida';