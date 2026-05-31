-- Tabela de listas (cada lista tem nome e pertence a um usuário)
create table if not exists listas_compras (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table listas_compras enable row level security;

create policy "Usuário acessa próprias listas"
  on listas_compras for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index listas_compras_user_id_idx on listas_compras(user_id);

-- Adiciona lista_id aos itens existentes (nullable para não quebrar dados antigos)
alter table lista_compras add column if not exists lista_id uuid references listas_compras(id) on delete cascade;

create index lista_compras_lista_id_idx on lista_compras(lista_id);
