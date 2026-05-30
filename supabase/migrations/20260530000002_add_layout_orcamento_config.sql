ALTER TABLE configuracoes_loja
  ADD COLUMN IF NOT EXISTS layout_orcamento_config JSONB DEFAULT '{}'::jsonb;
