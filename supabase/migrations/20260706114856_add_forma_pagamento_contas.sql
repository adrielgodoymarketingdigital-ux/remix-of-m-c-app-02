-- forma_pagamento: texto livre (não o enum forma_pagamento) para suportar formas
-- customizadas (useFormasPagamentoCustomizadas), que não existem no enum do banco.
ALTER TABLE public.contas ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;
ALTER TABLE public.contas ADD COLUMN IF NOT EXISTS forma_pagamento_entrada TEXT;
