-- Adicionar novo valor ao enum forma_pagamento
ALTER TYPE forma_pagamento ADD VALUE 'a_receber';

-- Adicionar colunas para controle de recebimento
ALTER TABLE vendas 
ADD COLUMN data_prevista_recebimento date,
ADD COLUMN recebido boolean DEFAULT false,
ADD COLUMN data_recebimento timestamp with time zone;