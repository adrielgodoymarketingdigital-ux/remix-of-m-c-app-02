-- Adicionar empresa_id nas tabelas restantes
alter table public.servicos             add column if not exists empresa_id uuid references public.empresas(id);
alter table public.orcamentos           add column if not exists empresa_id uuid references public.empresas(id);
alter table public.contas               add column if not exists empresa_id uuid references public.empresas(id);
alter table public.compras_dispositivos add column if not exists empresa_id uuid references public.empresas(id);
alter table public.origem_pessoas       add column if not exists empresa_id uuid references public.empresas(id);
alter table public.fornecedores         add column if not exists empresa_id uuid references public.empresas(id);
alter table public.fornecedores         add column if not exists deleted_at timestamptz;
alter table public.taxas_cartao         add column if not exists empresa_id uuid references public.empresas(id);
alter table public.tipos_servico        add column if not exists empresa_id uuid references public.empresas(id);

-- Índices
create index if not exists idx_servicos_empresa_id             on public.servicos(empresa_id);
create index if not exists idx_orcamentos_empresa_id           on public.orcamentos(empresa_id);
create index if not exists idx_contas_empresa_id               on public.contas(empresa_id);
create index if not exists idx_compras_dispositivos_empresa_id on public.compras_dispositivos(empresa_id);
create index if not exists idx_origem_pessoas_empresa_id       on public.origem_pessoas(empresa_id);
create index if not exists idx_fornecedores_empresa_id         on public.fornecedores(empresa_id);
create index if not exists idx_taxas_cartao_empresa_id         on public.taxas_cartao(empresa_id);
create index if not exists idx_tipos_servico_empresa_id        on public.tipos_servico(empresa_id);

-- Popular com a empresa matriz de cada proprietário
update public.servicos s
set empresa_id = (select e.id from public.empresas e where e.proprietario_id = s.user_id and e.tipo = 'matriz' limit 1)
where s.empresa_id is null;

update public.orcamentos o
set empresa_id = (select e.id from public.empresas e where e.proprietario_id = o.user_id and e.tipo = 'matriz' limit 1)
where o.empresa_id is null;

update public.contas c
set empresa_id = (select e.id from public.empresas e where e.proprietario_id = c.user_id and e.tipo = 'matriz' limit 1)
where c.empresa_id is null;

update public.compras_dispositivos cd
set empresa_id = (select e.id from public.empresas e where e.proprietario_id = cd.user_id and e.tipo = 'matriz' limit 1)
where cd.empresa_id is null;

update public.origem_pessoas op
set empresa_id = (select e.id from public.empresas e where e.proprietario_id = op.user_id and e.tipo = 'matriz' limit 1)
where op.empresa_id is null;

update public.fornecedores f
set empresa_id = (select e.id from public.empresas e where e.proprietario_id = f.user_id and e.tipo = 'matriz' limit 1)
where f.empresa_id is null;

update public.taxas_cartao tc
set empresa_id = (select e.id from public.empresas e where e.proprietario_id = tc.user_id and e.tipo = 'matriz' limit 1)
where tc.empresa_id is null;

update public.tipos_servico ts
set empresa_id = (select e.id from public.empresas e where e.proprietario_id = ts.user_id and e.tipo = 'matriz' limit 1)
where ts.empresa_id is null;
