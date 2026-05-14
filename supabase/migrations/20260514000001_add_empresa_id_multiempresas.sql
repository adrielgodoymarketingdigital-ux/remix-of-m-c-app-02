-- Parte 1: adicionar coluna tipo na tabela empresas (matriz/filial)
alter table public.empresas add column if not exists tipo text not null default 'filial';

-- Parte 2: adicionar empresa_id nas tabelas de dados
alter table public.ordens_servico add column if not exists empresa_id uuid references public.empresas(id);
alter table public.vendas         add column if not exists empresa_id uuid references public.empresas(id);
alter table public.clientes       add column if not exists empresa_id uuid references public.empresas(id);
alter table public.servicos_avulsos add column if not exists empresa_id uuid references public.empresas(id);
alter table public.caixas         add column if not exists empresa_id uuid references public.empresas(id);

-- Parte 3: índices para performance
create index if not exists idx_os_empresa_id        on public.ordens_servico(empresa_id);
create index if not exists idx_vendas_empresa_id    on public.vendas(empresa_id);
create index if not exists idx_clientes_empresa_id  on public.clientes(empresa_id);
create index if not exists idx_avulsos_empresa_id   on public.servicos_avulsos(empresa_id);
create index if not exists idx_caixas_empresa_id    on public.caixas(empresa_id);

-- Parte 4: popular empresa_id nos registros existentes
-- Para cada user_id, busca a empresa mais antiga como empresa principal (matriz)
update public.ordens_servico os
set empresa_id = (
  select e.id from public.empresas e
  where e.proprietario_id = os.user_id
  order by e.created_at asc
  limit 1
)
where os.empresa_id is null;

update public.vendas v
set empresa_id = (
  select e.id from public.empresas e
  where e.proprietario_id = v.user_id
  order by e.created_at asc
  limit 1
)
where v.empresa_id is null;

update public.clientes c
set empresa_id = (
  select e.id from public.empresas e
  where e.proprietario_id = c.user_id
  order by e.created_at asc
  limit 1
)
where c.empresa_id is null;

update public.servicos_avulsos sa
set empresa_id = (
  select e.id from public.empresas e
  where e.proprietario_id = sa.user_id
  order by e.created_at asc
  limit 1
)
where sa.empresa_id is null;

update public.caixas cx
set empresa_id = (
  select e.id from public.empresas e
  where e.proprietario_id = cx.user_id
  order by e.created_at asc
  limit 1
)
where cx.empresa_id is null;

-- Parte 5: marcar a empresa mais antiga de cada proprietário como matriz
update public.empresas e
set tipo = 'matriz'
where e.created_at = (
  select min(e2.created_at)
  from public.empresas e2
  where e2.proprietario_id = e.proprietario_id
);
