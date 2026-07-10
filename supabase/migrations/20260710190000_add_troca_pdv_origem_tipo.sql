-- Adiciona 'troca_pdv' como valor válido de origem_tipo, para marcar dispositivos
-- recebidos como parte de pagamento (troca) no PDV, diferenciando de compras
-- manuais de terceiro/fornecedor cadastradas em Origem de Dispositivos.
ALTER TABLE dispositivos DROP CONSTRAINT IF EXISTS dispositivos_origem_tipo_check;

ALTER TABLE dispositivos
ADD CONSTRAINT dispositivos_origem_tipo_check
CHECK (origem_tipo IN ('estoque_proprio', 'fornecedor', 'terceiro', 'troca_pdv'));
