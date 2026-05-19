-- Adiciona proprietario_id na tabela caixas para funcionários poderem fechar caixa
-- corretamente consultando vendas do dono da loja (user_id das vendas é o proprietário)
alter table public.caixas
  add column if not exists proprietario_id uuid references auth.users(id) on delete set null;
