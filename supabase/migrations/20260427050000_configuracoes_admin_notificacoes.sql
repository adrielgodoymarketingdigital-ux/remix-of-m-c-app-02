create table if not exists configuracoes_admin (
  id uuid primary key default gen_random_uuid(),
  preferencias_notificacao jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Garante que exista sempre exatamente uma linha
insert into configuracoes_admin (preferencias_notificacao)
select '{}'::jsonb
where not exists (select 1 from configuracoes_admin);

alter table configuracoes_admin enable row level security;

-- Apenas service_role acessa (Edge Functions usam service role key)
create policy "service_role_full_access" on configuracoes_admin
  for all
  to service_role
  using (true)
  with check (true);
