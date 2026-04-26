-- Adicionar coluna flow_config na tabela onboarding_config
ALTER TABLE onboarding_config 
ADD COLUMN IF NOT EXISTS flow_config JSONB DEFAULT '{
  "nodes": [],
  "edges": [],
  "metadata": {"versao": 1}
}'::jsonb;