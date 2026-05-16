create table vendas_avulsas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  descricao text not null,
  valor numeric(10,2) not null,
  forma_pagamento text not null,
  observacao text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz default null
);

create index idx_vendas_avulsas_user_id on vendas_avulsas(user_id);
create index idx_vendas_avulsas_created_at on vendas_avulsas(created_at);

alter table vendas_avulsas enable row level security;

create policy "usuario gerencia suas vendas avulsas"
  on vendas_avulsas for all
  using (auth.uid() = user_id);

create policy "funcionario ve vendas avulsas do dono"
  on vendas_avulsas for select
  using ((user_id = auth.uid()) or is_funcionario_of(user_id));

create policy "funcionario insere vendas avulsas para o dono"
  on vendas_avulsas for insert
  with check (
    auth.uid() = user_id or is_funcionario_of(user_id)
  );
