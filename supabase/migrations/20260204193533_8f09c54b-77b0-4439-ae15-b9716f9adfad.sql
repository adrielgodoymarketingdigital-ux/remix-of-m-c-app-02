-- Adicionar novos valores ao enum status_os
ALTER TYPE public.status_os ADD VALUE IF NOT EXISTS 'garantia';
ALTER TYPE public.status_os ADD VALUE IF NOT EXISTS 'estornado';