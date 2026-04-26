-- Adicionar o novo status "aguardando_retirada" ao enum status_os
ALTER TYPE status_os ADD VALUE IF NOT EXISTS 'aguardando_retirada';