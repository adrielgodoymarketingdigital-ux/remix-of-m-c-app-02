create table if not exists lista_compras (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  quantidade text not null default '1',
  concluido boolean not null default false,
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

alter table lista_compras enable row level security;

create policy "Usuário acessa própria lista"
  on lista_compras for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index lista_compras_user_id_idx on lista_compras(user_id);
