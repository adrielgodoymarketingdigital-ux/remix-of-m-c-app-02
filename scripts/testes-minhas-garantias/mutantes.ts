// deno run --allow-read --allow-write --allow-run scripts/testes-minhas-garantias/mutantes.ts
// Cada mutante altera UMA regra de src/lib/garantias/*, roda os testes desta
// pasta e precisa derrubar pelo menos um. O arquivo é SEMPRE restaurado.
const raiz = new URL("../../", import.meta.url);

const MUTANTES: [arquivo: string, de: string, para: string, nome: string][] = [
  ["src/lib/garantias/garantias.ts", "if (linhas.length === 0) return { lista: garantiasPadraoVirtuais(), virtual: true };",
    "if (linhas.filter((l) => !l.deleted_at).length === 0) return { lista: garantiasPadraoVirtuais(), virtual: true };", "padrões voltam quando tudo foi apagado"],
  ["src/lib/garantias/garantias.ts", "campos: { ...v, revisar: false }", "campos: { ...v }", "salvar não tira o revisar"],
  ["src/lib/garantias/garantias.ts", "d.meses > MESES_MAX", "d.meses > MESES_MAX + 1", "aceita prazo acima do CHECK"],
  ["src/lib/garantias/garantias.ts", "TEXTO_MAX_BYTES) erros.texto", "TEXTO_MAX_BYTES * 2) erros.texto", "aceita texto acima do CHECK"],
  ["src/lib/garantias/garantias.ts", "? n * 12 : n", "? n : n", "ano contado como mês"],
  ["src/lib/garantias/garantias.ts", "if (!usados.has(candidato.toLowerCase())) return candidato;", "return candidato;", "cópia com nome repetido"],
  ["src/lib/garantias/garantias.ts", "base[alvo(acao.chave)].deleted_at = acao.agora;", "void alvo(acao.chave);", "excluir padrão virtual não exclui"],
  ["src/lib/garantias/garantias.ts", "origem_ref: g.chave,", "origem_ref: null,", "padrões gravados sem origem_ref (duplicariam)"],
  ["src/lib/garantias/garantias.ts", ".filter((l) => !l.deleted_at)", "", "lista mostra apagadas"],
  ["src/lib/garantias/previa.ts", "if (meses >= 12 && meses % 12 === 0)", "if (meses > 12 && meses % 12 === 0)", "12 meses não vira '1 ano'"],
  ["src/lib/garantias/previa.ts", '\n    .replace(/\\{\\{garantia_meses\\}\\}\\s+meses\\b/gi, "{{garantia_meses}}");', ";", "volta o 'meses meses'"],
  ["src/lib/garantias/previa.ts", "loja?.cnpj?.trim() || DADOS_EXEMPLO_GARANTIA.loja_cnpj", "loja?.cnpj ?? DADOS_EXEMPLO_GARANTIA.loja_cnpj", "CNPJ em branco da loja na prévia"],
  ["src/lib/garantias/textoPadrao.ts", "1. GARANTIA CONTRATUAL ({{garantia_meses}})", "1. GARANTIA CONTRATUAL ({{garantia_meses}} meses)", "texto padrão com 'meses' repetido"],
  ["src/lib/garantias/textoPadrao.ts", "Garantia de {{garantia_meses}} a partir", "Garantia de 6 meses a partir", "texto padrão com prazo fixo"],
  ["src/lib/garantias/visibilidadeMinhasGarantias.ts", "export const MINHAS_GARANTIAS_LIBERADA = false;", "export const MINHAS_GARANTIAS_LIBERADA = true;", "freio solto na fase A"],
  ["src/lib/garantias/visibilidadeMinhasGarantias.ts", 'ctx.papel === "dono"', 'ctx.papel !== "gerente"', "funcionário vê a tela quando liberar"],
];

async function testesFalham(): Promise<boolean> {
  const r = await new Deno.Command("deno", {
    args: ["test", "--no-check", "--allow-run", "--allow-read", "scripts/testes-minhas-garantias/"],
    cwd: raiz,
    env: { TZ: "UTC" },
    stdout: "null",
    stderr: "null",
  }).output();
  return !r.success;
}

let vivos = 0;
if (await testesFalham()) {
  console.error("Os testes já falham sem mutante: corrija antes.");
  Deno.exit(1);
}
for (const [arquivo, de, para, nome] of MUTANTES) {
  const url = new URL(arquivo, raiz);
  const original = Deno.readTextFileSync(url);
  if (!original.includes(de)) {
    console.log(`  ? ${nome}: trecho não encontrado (ajustar o mutante)`);
    vivos++;
    continue;
  }
  try {
    Deno.writeTextFileSync(url, original.replace(de, para));
    const morto = await testesFalham();
    console.log(`  ${morto ? "✓ morto" : "✗ VIVO "} ${nome}`);
    if (!morto) vivos++;
  } finally {
    Deno.writeTextFileSync(url, original);
  }
}
console.log(vivos === 0 ? `\nOK: ${MUTANTES.length} mutantes mortos` : `\n${vivos} mutante(s) vivo(s)`);
Deno.exit(vivos === 0 ? 0 : 1);
