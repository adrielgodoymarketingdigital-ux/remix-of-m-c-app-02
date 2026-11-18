// Prova em Postgres local (PGlite 0.3.16), sem produção: venda sem `data` recebe a hora do banco e
// o insert devolve a linha para dono, funcionário e gerente, com as policies copiadas das migrations.
//   PGLITE_PATH=<.../@electric-sql/pglite/dist/index.js> node scripts/testes-caixa-relogio/pdv-insert.pglite.mjs
const { PGlite } = await import(process.env.PGLITE_PATH ?? "@electric-sql/pglite");
const DONO = "00000000-0000-4000-8000-000000000001", FUNC = "00000000-0000-4000-8000-000000000002";
const GERENTE = "00000000-0000-4000-8000-000000000003", INTRUSO = "00000000-0000-4000-8000-000000000004";
const FILIAL = "00000000-0000-4000-8000-0000000000f1", OUTRA = "00000000-0000-4000-8000-0000000000f2";
let falhas = 0;
const confere = (n, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) falhas++; console.log(`${ok ? "ok   " : "FALHA"} ${n}${ok ? "" : `: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`}`); };
const db = new PGlite();
await db.exec(`
  CREATE ROLE authenticated;
  CREATE SCHEMA auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.uid', true), '')::uuid $$;
  CREATE TABLE public.loja_funcionarios (funcionario_user_id uuid, loja_user_id uuid, ativo boolean);
  CREATE TABLE public.empresa_usuarios (gerente_id uuid, proprietario_id uuid, empresa_id uuid);
  CREATE FUNCTION public.is_funcionario_of(dono uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
    $$ SELECT EXISTS (SELECT 1 FROM public.loja_funcionarios f WHERE f.funcionario_user_id = auth.uid() AND f.loja_user_id = dono AND f.ativo) $$;
  CREATE TABLE public.vendas (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, empresa_id uuid, grupo_venda uuid, total numeric(10,2) NOT NULL, data timestamptz DEFAULT now());
  ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users can view own sales" ON public.vendas FOR SELECT TO authenticated USING (auth.uid() = user_id);
  CREATE POLICY "Users can insert own sales" ON public.vendas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "Funcionarios podem ver vendas do dono" ON public.vendas FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_funcionario_of(user_id));
  CREATE POLICY "Funcionarios podem inserir vendas para o dono" ON public.vendas FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.is_funcionario_of(user_id));
  CREATE POLICY "gerente pode inserir venda com user_id do proprietario" ON public.vendas FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.empresa_usuarios eu WHERE eu.gerente_id = auth.uid() AND eu.proprietario_id = vendas.user_id AND eu.empresa_id = vendas.empresa_id));
  CREATE POLICY "gerente ve registros da filial em vendas" ON public.vendas FOR SELECT USING (EXISTS (SELECT 1 FROM public.empresa_usuarios eu WHERE eu.gerente_id = auth.uid() AND eu.proprietario_id = vendas.user_id AND eu.empresa_id = vendas.empresa_id));
  GRANT USAGE ON SCHEMA public, auth TO authenticated;
  GRANT SELECT, INSERT ON public.vendas TO authenticated;
  GRANT SELECT ON public.empresa_usuarios TO authenticated;
  GRANT EXECUTE ON FUNCTION auth.uid(), public.is_funcionario_of(uuid) TO authenticated;
  INSERT INTO public.loja_funcionarios VALUES ('${FUNC}', '${DONO}', true);
  INSERT INTO public.empresa_usuarios VALUES ('${GERENTE}', '${DONO}', '${FILIAL}');
`);
async function inserir(uid, empresa) {
  await db.exec(`RESET ROLE; SELECT set_config('app.uid', '${uid}', false); SET ROLE authenticated;`);
  const e = empresa ? `'${empresa}'` : "NULL";
  const r = await db.query(`INSERT INTO public.vendas (user_id, empresa_id, total) VALUES ('${DONO}', ${e}, 10) RETURNING id, data, abs(extract(epoch FROM data - now())) < 5 AS hora_do_banco`);
  await db.exec("RESET ROLE");
  return r.rows[0];
}
for (const [nome, uid, empresa] of [["dono", DONO, null], ["funcionário", FUNC, null], ["gerente da filial", GERENTE, FILIAL]]) {
  const linha = await inserir(uid, empresa);
  confere(`${nome}: o insert devolve a linha`, !!linha?.id, true);
  confere(`${nome}: a data devolvida é a hora do banco`, linha?.hora_do_banco, true);
}
let barrado = false;
try { await inserir(INTRUSO, null); } catch { barrado = true; await db.exec("RESET ROLE"); }
confere("usuário de outra loja continua barrado", barrado, true);
barrado = false;
try { await inserir(GERENTE, OUTRA); } catch { barrado = true; await db.exec("RESET ROLE"); }
confere("gerente em outra filial continua barrado", barrado, true);
console.log(falhas ? `${falhas} falha(s)` : "insert provado");
process.exit(falhas ? 1 : 0);
