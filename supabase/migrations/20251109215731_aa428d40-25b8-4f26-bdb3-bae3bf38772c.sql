-- Adicionar novos valores ao enum status_os
-- Estes valores serão disponibilizados para uso após commit
ALTER TYPE status_os ADD VALUE IF NOT EXISTS 'aguardando_aprovacao';
ALTER TYPE status_os ADD VALUE IF NOT EXISTS 'finalizado';
ALTER TYPE status_os ADD VALUE IF NOT EXISTS 'entregue';