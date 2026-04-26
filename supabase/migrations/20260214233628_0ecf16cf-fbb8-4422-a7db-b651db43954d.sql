
-- Adicionar coluna JSONB para comissões por cargo
ALTER TABLE public.loja_funcionarios 
ADD COLUMN IF NOT EXISTS comissoes_por_cargo jsonb DEFAULT NULL;

-- Migrar dados existentes: se tem comissao configurada + cargo, popular a nova coluna
UPDATE public.loja_funcionarios
SET comissoes_por_cargo = jsonb_build_object(
  COALESCE(split_part(cargo, ',', 1), 'Geral'),
  jsonb_build_object(
    'tipo', comissao_tipo,
    'valor', comissao_valor,
    'escopo', comissao_escopo
  )
)
WHERE comissao_tipo IS NOT NULL AND comissao_valor > 0;
