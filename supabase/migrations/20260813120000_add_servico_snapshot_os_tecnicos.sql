-- Vincula cada técnico da OS ao serviço específico que ele realizou, com
-- snapshot do preço daquele serviço. Antes, a comissão de cada técnico era
-- calculada sobre o valor TOTAL da OS, mesmo quando havia múltiplos
-- serviços com preços/comissões diferentes — resultando em comissão
-- incorreta. Agora a comissão é calculada sobre o preço do serviço
-- vinculado ao técnico.
ALTER TABLE public.os_tecnicos
  ADD COLUMN IF NOT EXISTS servico_id text,
  ADD COLUMN IF NOT EXISTS servico_nome_snapshot text,
  ADD COLUMN IF NOT EXISTS preco_servico_snapshot numeric;
