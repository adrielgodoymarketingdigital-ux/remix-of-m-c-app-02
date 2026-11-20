// deno test --no-check --allow-run --allow-read scripts/testes-minhas-garantias/
// A migration de cópia e a prévia estão em dia com o gerador (mesmo núcleo,
// texto padrão igual ao de src/lib/garantias/textoPadrao.ts byte a byte).
import { assert } from "jsr:@std/assert@1";
import { TEXTO_PADRAO_COM_GARANTIA, TEXTO_PADRAO_SEM_GARANTIA } from "../../src/lib/garantias/textoPadrao.ts";

const raiz = new URL("../../", import.meta.url);
const ler = (p: string) => Deno.readTextFileSync(new URL(p, raiz));
/** SQL sem comentários e sem o conteúdo de textos ('...' e $tag$...$tag$), para procurar comandos. */
const soComandos = (sql: string) =>
  sql.replace(/\$(\w*)\$[\s\S]*?\$\1\$/g, "''")
    .replace(/'(?:[^']|'')*'/g, "''")
    .split("\n").filter((l) => !l.trimStart().startsWith("--")).map((l) => l.replace(/--.*$/, "")).join("\n");

Deno.test("gerador --verificar: migration e prévia atualizadas", async () => {
  const r = await new Deno.Command("node", {
    args: ["scripts/minhas-garantias/gerar-sql-copia.ts", "--verificar"],
    cwd: raiz,
    stdout: "piped",
    stderr: "piped",
  }).output();
  assert(r.success, new TextDecoder().decode(r.stderr));
});

Deno.test("o texto padrão está dentro da migration byte a byte", () => {
  const sql = ler("supabase/migrations/20261120120100_minhas_garantias_copia_dados.sql");
  assert(sql.includes(`$padrao_com$${TEXTO_PADRAO_COM_GARANTIA}$padrao_com$`));
  assert(sql.includes(`$padrao_sem$${TEXTO_PADRAO_SEM_GARANTIA}$padrao_sem$`));
});

Deno.test("a prévia é só leitura (nenhum comando que grava)", () => {
  const previa = soComandos(ler("scripts/minhas-garantias/2-previa-copia.sql"));
  for (const proibido of [/\binsert\b/i, /\bupdate\b/i, /\bdelete\b/i, /\bcreate\b/i, /\balter\b/i, /\bdrop\b/i, /\btruncate\b/i, /\bgrant\b/i, /\bbegin\b/i]) {
    assert(!proibido.test(previa), `prévia contém ${proibido}`);
  }
});

Deno.test("conferência e verificações também são só leitura", () => {
  for (const arq of ["0-conferir-producao.sql", "1-verificar-estrutura.sql", "1b-verificar-validacao-indices.sql", "3-verificar-copia.sql"]) {
    const sql = soComandos(ler(`scripts/minhas-garantias/${arq}`));
    for (const proibido of [/\binsert\b/i, /\bupdate\b/i, /\bdelete\b/i, /\bcreate\b/i, /\balter\b/i, /\bdrop\b/i, /\btruncate\b/i, /\bbegin\b/i]) {
      assert(!proibido.test(sql), `${arq} contém ${proibido}`);
    }
  }
});

Deno.test("arquivos de índice: um comando só, CONCURRENTLY, IF NOT EXISTS, sem transação", () => {
  for (const arq of ["20261120120020_minhas_garantias_indice_vendas_garantia_id.sql", "20261120120030_minhas_garantias_indice_vendas_garantia_texto_id.sql"]) {
    const sql = soComandos(ler(`supabase/migrations/${arq}`));
    const comandos = sql.split(";").map((c) => c.trim()).filter(Boolean);
    assert(comandos.length === 1, `${arq}: ${comandos.length} comandos`);
    assert(/^CREATE INDEX CONCURRENTLY IF NOT EXISTS/.test(comandos[0]), arq);
    assert(!/\bbegin\b|\bset\b/i.test(sql), `${arq} não pode ter BEGIN/SET`);
  }
});

Deno.test("validação: lock_timeout, só VALIDATE (nada de ADD/DROP/UPDATE)", () => {
  // aqui o corpo $$...$$ importa (é onde está o VALIDATE): tira só comentários e textos '...'
  const sql = ler("supabase/migrations/20261120120010_minhas_garantias_validar_constraints.sql")
    .split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
  assert(sql.includes("SET LOCAL lock_timeout = '5s';"), "lock_timeout");
  assert(sql.includes("VALIDATE CONSTRAINT"));
  const semTextos = sql.replace(/'(?:[^']|'')*'/g, "''");
  for (const proibido of [/\badd\b/i, /\bdrop\b/i, /\bupdate\b/i, /\binsert\b/i, /\bdelete\b/i]) assert(!proibido.test(semTextos), `${proibido}`);
});
