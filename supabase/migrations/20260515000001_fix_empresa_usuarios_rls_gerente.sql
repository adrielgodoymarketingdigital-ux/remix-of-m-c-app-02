-- Garante que gerentes de filial possam ler sua própria linha em empresa_usuarios.
-- Sem essa policy, a query do frontend retorna vazia e o gerente não herda o plano do proprietário.

-- Habilitar RLS caso ainda não esteja (idempotente)
alter table public.empresa_usuarios enable row level security;

-- Remover policy existente se houver (evita duplicata)
drop policy if exists "gerente pode ler sua propria linha" on public.empresa_usuarios;

-- Proprietário pode ver todas as linhas das suas empresas
drop policy if exists "proprietario pode ver empresa_usuarios" on public.empresa_usuarios;
create policy "proprietario pode ver empresa_usuarios"
  on public.empresa_usuarios
  for select
  using (proprietario_id = auth.uid());

-- Gerente pode ler a linha onde ele é gerente (para herdar plano do proprietário)
create policy "gerente pode ler sua propria linha"
  on public.empresa_usuarios
  for select
  using (gerente_id = auth.uid());
