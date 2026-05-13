create table tiny_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  nome_assistencia text,
  auto_refresh_interval integer default 15,
  connected_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id)
);

alter table tiny_integrations enable row level security;

create policy "usuario ve apenas seus tokens"
  on tiny_integrations for all
  using (auth.uid() = user_id);
