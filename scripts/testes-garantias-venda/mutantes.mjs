// node scripts/testes-garantias-venda/mutantes.mjs
// Cada mutante altera UMA regra da fase B (lib ou PDV.tsx), roda os testes desta
// pasta e precisa derrubar pelo menos um. O arquivo é SEMPRE restaurado.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const TESTES = ["lib", "gravacao", "comparacao"].map((n) => `scripts/testes-garantias-venda/${n}.test.ts`);
const VG = "src/lib/garantias/vendaGarantia.ts";
const PDV = "src/pages/PDV.tsx";

const MUTANTES = [
  [VG, '  if (e.meses <= 0) return null; // "Sem garantia": nada de texto congelado\n', "", "sem a regra 'sem texto congelado quando 0 meses'"],
  [VG, "  if (existente) {", "  if (false && existente) {", "sem reaproveitar texto já congelado"],
  [PDV, "congelarTextosDaVenda(repositorioTextosSupabase(supabase), userIdParaVenda, itensCarrinho)", "congelarTextosDaVenda(repositorioTextosSupabase(supabase), user.id, itensCarrinho)", "texto gravado em nome de quem vende, não do dono"],
  [VG, "      textoIdPorItem.push(null);\n      falhas++;", "      throw erro;", "sem o fallback da lib (erro num item derruba os outros)"],
  [PDV, '          console.error("[PDV] texto da garantia não gravado; a venda segue", erroTexto);', "          throw erroTexto;", "sem o fallback do PDV (erro do texto derruba a venda)"],
  [VG, '  if (item.tipo !== "dispositivo" || !e) return null;', "  if (!e) return null;", "texto congelado também para item que não é aparelho"],
  [VG, '  if (item.tipo !== "dispositivo" || !e) return {};', "  if (!e) return {};", "colunas de garantia também em item que não é aparelho"],
  [VG, "garantia_texto_id: e.meses > 0 ? textoId ?? null : null,", "garantia_texto_id: textoId ?? null,", "texto congelado ligado a venda 'sem garantia'"],
  [VG, "tempo_garantia: e.meses > 0 ? e.meses : null,", "tempo_garantia: e.meses,", "tempo_garantia legado 0 em vez de nulo"],
  [PDV, "            ...camposGarantiaVenda(item, textosGarantia.textoIdPorItem[idxItem]),\n", "", "venda sem as colunas da garantia escolhida"],
  [PDV, "...(escolhaGarantiaValida(state.garantiaEscolhida) ? { garantia_escolhida: state.garantiaEscolhida } : {})", "...(state.garantiaEscolhida ? { garantia_escolhida: state.garantiaEscolhida } : {})", "state do cartão aceito sem conferir"],
  [VG, "const achada = lista.find((g) => g.ativo && g.meses === alvo);", "const achada = lista.find((g) => g.meses === alvo);", "pré-seleção aceita garantia desativada"],
  [VG, "    if (existente.texto !== texto) throw", "    if (false) throw", "md5 igual com texto diferente aceito"],
  ["src/lib/garantias/md5.ts", "vista.setUint32(tamanho - 8, bits >>> 0, true);", "vista.setUint32(tamanho - 8, bits >>> 0, false);", "md5 errado (tamanho big-endian)"],
  ["src/lib/garantias/visibilidadeMinhasGarantias.ts", "export const MINHAS_GARANTIAS_LIBERADA = false;", "export const MINHAS_GARANTIAS_LIBERADA = true;", "freio solto"],
];

const testesFalham = () => spawnSync("node", ["--test", ...TESTES], { cwd: raiz, stdio: "ignore" }).status !== 0;

if (testesFalham()) { console.error("Os testes já falham sem mutante: corrija antes."); process.exit(1); }
let vivos = 0;
for (const [arq, de, para, nome] of MUTANTES) {
  const caminho = join(raiz, arq);
  const original = readFileSync(caminho, "utf8");
  if (!original.includes(de)) {
    console.log(`  ? ${nome}: trecho não encontrado`);
    vivos++;
    continue;
  }
  if (de === para) { console.log(`  ? ${nome}: mutação vazia`); vivos++; continue; }
  try {
    writeFileSync(caminho, original.replace(de, para));
    const morto = testesFalham();
    console.log(`  ${morto ? "✓ morto" : "✗ VIVO "} ${nome}`);
    if (!morto) vivos++;
  } finally {
    writeFileSync(caminho, original);
  }
}
console.log(vivos === 0 ? `\nOK: ${MUTANTES.length} mutantes mortos` : `\n${vivos} mutante(s) vivo(s)`);
process.exit(vivos === 0 ? 0 : 1);
