create table if not exists public.caixas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data_abertura timestamptz not null default now(),
  data_fechamento timestamptz,
  saldo_inicial numeric(10,2) not null default 0,
  saldo_final numeric(10,2),
  total_vendas numeric(10,2) default 0,
  total_dinheiro numeric(10,2) default 0,
  total_pix numeric(10,2) default 0,
  total_cartao numeric(10,2) default 0,
  total_a_receber numeric(10,2) default 0,
  observacoes text,
  status text not null default 'aberto' check (status in ('aberto', 'fechado')),
  created_at timestamptz default now()
);

alter table public.caixas enable row level security;

create policy "Usuário vê próprios caixas"
  on public.caixas for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
