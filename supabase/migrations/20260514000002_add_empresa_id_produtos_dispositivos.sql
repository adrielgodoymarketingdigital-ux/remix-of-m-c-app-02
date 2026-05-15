-- Adicionar empresa_id nas tabelas que faltaram na migração anterior
alter table public.produtos    add column if not exists empresa_id uuid references public.empresas(id);
alter table public.pecas       add column if not exists empresa_id uuid references public.empresas(id);
alter table public.dispositivos add column if not exists empresa_id uuid references public.empresas(id);

-- Índices para performance
create index if not exists idx_produtos_empresa_id    on public.produtos(empresa_id);
create index if not exists idx_pecas_empresa_id       on public.pecas(empresa_id);
create index if not exists idx_dispositivos_empresa_id on public.dispositivos(empresa_id);

-- Popular empresa_id nos registros existentes com a empresa matriz do proprietário
update public.produtos p
set empresa_id = (
  select e.id from public.empresas e
  where e.proprietario_id = p.user_id and e.tipo = 'matriz'
  limit 1
)
where p.empresa_id is null;

update public.pecas p
set empresa_id = (
  select e.id from public.empresas e
  where e.proprietario_id = p.user_id and e.tipo = 'matriz'
  limit 1
)
where p.empresa_id is null;

update public.dispositivos d
set empresa_id = (
  select e.id from public.empresas e
  where e.proprietario_id = d.user_id and e.tipo = 'matriz'
  limit 1
)
where d.empresa_id is null;
