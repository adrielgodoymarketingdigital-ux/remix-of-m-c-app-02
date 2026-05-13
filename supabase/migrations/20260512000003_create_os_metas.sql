create table if not exists public.os_metas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  mes int not null,
  ano int not null,
  meta numeric not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, mes, ano)
);

alter table public.os_metas enable row level security;

create policy "usuario gerencia apenas suas metas"
  on public.os_metas for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
