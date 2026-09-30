-- =====================================================================
-- "Meus padrões de etiqueta": folhas de etiqueta medidas pelo próprio
-- usuário (diálogo Gerar Etiquetas, em Produtos), reutilizáveis na impressão.
--
-- 100% ADITIVA: uma coluna nova em configuracoes_loja, começando vazia ('[]')
-- para todo mundo — nenhuma linha existente muda de comportamento.
--
-- Formato: lista JSON de
--   { id, nome, larguraFolhaMm, larguraMm, alturaMm, colunas, linhas | null }
-- (medidas em mm; linhas null = calculadas pela quantidade na impressão).
--
-- Guardada na linha da matriz (empresa_id IS NULL) do dono da loja. Coberta
-- pelas policies RLS já existentes de configuracoes_loja (dono + funcionários
-- via is_funcionario_of). Nenhuma policy nova é necessária.
-- =====================================================================

ALTER TABLE public.configuracoes_loja
  ADD COLUMN IF NOT EXISTS etiquetas_padroes jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.configuracoes_loja.etiquetas_padroes IS
  'Padrões de folha de etiqueta cadastrados pela loja: [{id, nome, larguraFolhaMm, larguraMm, alturaMm, colunas, linhas|null}].';
