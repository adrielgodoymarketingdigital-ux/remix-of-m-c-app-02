-- Adicionar tipo 'trial' ao enum plano_tipo
ALTER TYPE public.plano_tipo ADD VALUE IF NOT EXISTS 'trial' AFTER 'demonstracao';