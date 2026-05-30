-- Adiciona empresa_id opcional em loja_funcionarios para suporte a MultiEmpresas.
-- Funcionários existentes ficam com empresa_id = NULL (pertencem à matriz).
-- Não altera nenhuma constraint ou índice existente.

ALTER TABLE loja_funcionarios
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_loja_funcionarios_empresa_id
  ON loja_funcionarios(empresa_id);
