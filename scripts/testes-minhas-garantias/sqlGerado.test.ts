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
  for (const arq of ["0-conferir-producao.sql", "1-verificar-estrutura.sql", "3-verificar-copia.sql"]) {
    const sql = soComandos(ler(`scripts/minhas-garantias/${arq}`));
    for (const proibido of [/\binsert\b/i, /\bupdate\b/i, /\bdelete\b/i, /\bcreate\b/i, /\balter\b/i, /\bdrop\b/i, /\btruncate\b/i, /\bbegin\b/i]) {
      assert(!proibido.test(sql), `${arq} contém ${proibido}`);
    }
  }
});
