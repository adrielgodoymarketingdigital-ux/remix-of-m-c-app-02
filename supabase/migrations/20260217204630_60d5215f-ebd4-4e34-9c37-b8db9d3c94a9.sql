-- Adicionar colunas para armazenar fornecedor e status de pagamento do serviço na OS
ALTER TABLE public.ordens_servico 
ADD COLUMN servico_fornecedor_id uuid REFERENCES public.fornecedores(id),
ADD COLUMN servico_status_pagamento text DEFAULT 'pago',
ADD COLUMN servico_data_pagamento date;

-- Comentários para documentação
COMMENT ON COLUMN public.ordens_servico.servico_fornecedor_id IS 'Fornecedor da peça usada no serviço';
COMMENT ON COLUMN public.ordens_servico.servico_status_pagamento IS 'Status do pagamento da peça: pago ou a_pagar';
COMMENT ON COLUMN public.ordens_servico.servico_data_pagamento IS 'Data do pagamento ou vencimento da peça';