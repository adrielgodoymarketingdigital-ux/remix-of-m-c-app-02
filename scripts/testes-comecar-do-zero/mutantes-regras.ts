// deno run --allow-read --allow-write --allow-run --allow-env scripts/testes-comecar-do-zero/mutantes-regras.ts
//
// Mutantes de src/lib/comecarDoZero/regras.ts (regras da tela do "Começar do
// zero", parte "Produtos e peças"): cada um é aplicado numa CÓPIA (pasta
// temporária; o repositório não é tocado) e regras.test.ts tem que FALHAR.
// Mutante vivo = teste fraco. (Os mutantes do SQL ficam em
// scripts/zerar-produtos-pecas/teste-pglite.mjs --mutantes, que também prova
// tela = banco nas 255 escolhas.)

const raiz = new URL("../../", import.meta.url);
const REGRAS = "src/lib/comecarDoZero/regras.ts";
const TESTE = "scripts/testes-comecar-do-zero/regras.test.ts";

interface Mutante { nome: string; de: string; para: string }
const MUTANTES: Mutante[] = [
  { nome: "Tudo inclui Produtos e peças", de: 'ORDEM_CATEGORIAS.filter((c) => c !== "produtos_pecas");', para: "ORDEM_CATEGORIAS.filter(() => true);" },
  { nome: "sem absorção pelo Estoque", de: 'if (ef.has("estoque") && ef.has("produtos_pecas")) {', para: "if (false) {" },
  { nome: "absorção sem registrar", de: '    absorvidas.push({ categoria: "produtos_pecas", por_causa_de: "estoque", motivo: "O Estoque já apaga os produtos e as peças." });\n', para: "" },
  { nome: "Produtos e peças não inclui vendas", de: 'if (ef.has("produtos_pecas")) incluir("vendas", "produtos_pecas",', para: 'if (false) incluir("vendas", "produtos_pecas",' },
  // (trocar a ordem entre a inclusão do Estoque e a de Produtos e peças é EQUIVALENTE: depois da absorção os dois nunca estão juntos)
  { nome: "Produtos e peças inclui vendas antes de Clientes", de: '  if (ef.has("clientes")) {\n', para: '  if (ef.has("produtos_pecas") && !ef.has("estoque")) incluir("vendas", "produtos_pecas", "As vendas ficariam sem o produto ou a peça vendida.");\n  if (ef.has("clientes")) {\n' },
  { nome: "motivo da inclusão diferente do banco", de: '"As vendas ficariam sem o produto ou a peça vendida."', para: '"As vendas ficariam sem o produto."' },
  { nome: "aviso sem o TODAS", de: '"Apagar produtos e peças também apaga TODAS as vendas, inclusive as de aparelhos."', para: '"Apagar produtos e peças também apaga as vendas."' },
  { nome: "fica sem os fornecedores no texto", de: '"Os aparelhos, as compras de aparelhos, os fornecedores, as listas de compras e as notas XML continuam."', para: '"Os aparelhos continuam."' },
  { nome: "Produtos e peças depois de Orçamentos", de: '"estoque", "produtos_pecas", "orcamentos"];', para: '"estoque", "orcamentos", "produtos_pecas"];' },
  { nome: "resumo sem as entradas", de: ' entradas_estoque: ["entrada de estoque", "entradas de estoque"], ligacoes_xml:', para: " ligacoes_xml:" },
  { nome: "texto do Estoque mudou", de: '"Apagar o estoque também apaga as vendas."', para: '"Apagar o estoque também apaga as vendas e os produtos."' },
];

async function copiar(destino: string, alterado?: { arquivo: string; conteudo: string }) {
  for (const p of [REGRAS, TESTE]) {
    const alvo = `${destino}/${p}`;
    await Deno.mkdir(alvo.slice(0, alvo.lastIndexOf("/")), { recursive: true });
    await Deno.writeTextFile(alvo, alterado?.arquivo === p ? alterado.conteudo : await Deno.readTextFile(new URL(p, raiz)));
  }
}
async function testesPassam(dir: string): Promise<boolean> {
  const r = await new Deno.Command(Deno.execPath(), { args: ["test", "--no-check", "--quiet", `${dir}/${TESTE}`], stdout: "null", stderr: "null" }).output();
  return r.success;
}

const base = await Deno.makeTempDir();
await copiar(base);
if (!(await testesPassam(base))) { console.log("FALHA a cópia sem mutação não passa"); Deno.exit(1); }
console.log("OK    cópia sem mutação passa");
const original = await Deno.readTextFile(new URL(REGRAS, raiz));
let vivos = 0;
for (const m of MUTANTES) {
  if (!original.includes(m.de)) { console.log(`ERRO  mutante "${m.nome}" não achou o trecho`); vivos++; continue; }
  const dir = await Deno.makeTempDir();
  await copiar(dir, { arquivo: REGRAS, conteudo: original.replace(m.de, m.para) });
  const passou = await testesPassam(dir);
  if (passou) vivos++;
  console.log(`${passou ? "VIVO!" : "MORTO"} ${m.nome}`);
  await Deno.remove(dir, { recursive: true });
}
await Deno.remove(base, { recursive: true });
console.log(`(${MUTANTES.length} mutantes)\n${vivos ? `${vivos} VIVO(S)` : "TODOS MORTOS"}`);
Deno.exit(vivos ? 1 : 0);
