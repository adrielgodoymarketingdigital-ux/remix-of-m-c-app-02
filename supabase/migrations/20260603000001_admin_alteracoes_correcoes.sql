create table if not exists admin_alteracoes_correcoes (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  prioridade text not null check (prioridade in ('muito_urgente', 'urgente', 'melhoria', 'nao_urgente')),
  concluido boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Apenas admins têm acesso
alter table admin_alteracoes_correcoes enable row level security;

create policy "admins_all" on admin_alteracoes_correcoes
  for all
  using (
    exists (
      select 1 from user_roles
      where user_id = auth.uid()
      and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from user_roles
      where user_id = auth.uid()
      and role = 'admin'
    )
  );
