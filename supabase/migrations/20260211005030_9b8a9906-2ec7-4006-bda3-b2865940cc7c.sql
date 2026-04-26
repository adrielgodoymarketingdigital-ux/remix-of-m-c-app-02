
ALTER TABLE public.contas ADD COLUMN IF NOT EXISTS data_vencimento date;
ALTER TABLE public.contas ADD COLUMN IF NOT EXISTS valor_pago numeric DEFAULT 0;
ALTER TABLE public.contas ADD COLUMN IF NOT EXISTS os_numero text;
ALTER TYPE forma_pagamento ADD VALUE IF NOT EXISTS 'a_prazo';
