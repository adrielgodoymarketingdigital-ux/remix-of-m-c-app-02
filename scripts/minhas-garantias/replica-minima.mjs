// Réplica mínima do banco de produção usada pelos testes de "Minhas garantias"
// (teste-pglite.mjs e teste-lock-postgres.mjs). Só o que as migrations usam.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const ler = (p) => readFileSync(join(raiz, p), "utf8");
export const TIPOS_GARANTIA = ler("supabase/migrations/20260617000001_create_tipos_garantia.sql");

// _zerar_catalogo() como está em 20261102120000 (a última que a redefiniu no repositório).
export function zerarCatalogoBase() {
  const f = ler("supabase/migrations/20261102120000_configuracao_estoque_baixo.sql");
  const ini = f.indexOf("CREATE OR REPLACE FUNCTION public._zerar_catalogo()");
  const fim = f.indexOf("$$;", ini) + 3;
  return f.slice(ini, fim) + "\nREVOKE ALL ON FUNCTION public._zerar_catalogo() FROM PUBLIC, anon, authenticated;\n";
}

export const BASE = `
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
-- Como o Supabase: tudo novo em public nasce com ALL para anon/authenticated.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

CREATE TABLE public.empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nome text NOT NULL DEFAULT 'x',
  proprietario_id uuid, tipo text NOT NULL, ativa boolean DEFAULT true, created_at timestamptz DEFAULT now());
CREATE TABLE public.empresa_usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid, gerente_id uuid, proprietario_id uuid);
CREATE TABLE public.loja_funcionarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), funcionario_user_id uuid, loja_user_id uuid, ativo boolean DEFAULT true);
CREATE OR REPLACE FUNCTION public.is_funcionario_of(owner_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.loja_funcionarios
    WHERE funcionario_user_id = auth.uid() AND loja_user_id = owner_user_id AND ativo = true) $$;
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TABLE public.configuracoes_loja (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, empresa_id uuid,
  termo_garantia_dispositivo_config jsonb, created_at timestamptz DEFAULT now());
CREATE TABLE public.vendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, empresa_id uuid, tempo_garantia integer);
CREATE TABLE public.dispositivos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL);
`;

