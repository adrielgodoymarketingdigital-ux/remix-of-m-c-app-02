// node scripts/testes-recibo-cor-cabecalho/mutantes.mjs
// Cada mutante altera UMA regra (lib, CSS dos recibos, modelo da venda ou
// gravação), roda os testes desta pasta e precisa derrubar pelo menos um.
// O arquivo é SEMPRE restaurado.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const TESTES = ["lib", "recibos", "gravacao"].map((n) => `scripts/testes-recibo-cor-cabecalho/${n}.test.ts`);
const LIB = "src/lib/recibo/corCabecalhoRecibo.ts";
const OS = "src/components/ordens/recibo-personalizado/cssReciboPersonalizado.ts";
const VENDA = "src/components/vendas/recibo-novo/cssReciboVendaNovo.ts";
const MODELO = "src/lib/vendas/reciboVendaModelo.ts";
const GRAV = "src/lib/configuracaoLoja/coresPersonalizadasLinhas.ts";

const MUTANTES = [
  [LIB, "if (/^#[0-9a-f]{6}$/.test(v)) return v;", "if (/^#[0-9a-f]{6}/.test(v)) return v;", "hex aceito com lixo depois (sem $)"],
  [LIB, "const v = valor.trim().toLowerCase();", "const v = valor.trim();", "hex sem normalizar para minúsculas"],
  [LIB, "  } catch {\n    return null;\n  }", "  } catch (e) {\n    throw e;\n  }", "erro ao ler a loja propaga em vez de cair no azul"],
  [LIB, "  const fundo2 = escurecer(fundo, 0.15);", "  const fundo2 = escurecer(fundo, 0.3);", "degradê 30% em vez de 15%"],
  [LIB, "piorContraste(TEXTO_CLARO, fundos) >= piorContraste(TEXTO_ESCURO, fundos)", "piorContraste(TEXTO_CLARO, fundos) <= piorContraste(TEXTO_ESCURO, fundos)", "texto escolhido ao contrário (sem contraste)"],
  [LIB, "if (piorContraste(candidato, fundos) >= CONTRASTE_MINIMO_ACENTO) {", "if (true) {", "destaque sem conferir o contraste"],
  [OS, "  if (!hex) return \"\";\n  const p = paletaCabecalhoRecibo(hex);\n  return comImportant(", "  const p = paletaCabecalhoRecibo(hex ?? \"#0a1a3f\");\n  return comImportant(", "OS: CSS a mais mesmo sem cor escolhida"],
  [OS, "  return comImportant(`\n${R} .osr-header { background: linear-gradient(135deg, ${p.fundo}", "  return (`\n${R} .osr-header { background: linear-gradient(135deg, ${p.fundo}", "OS: regras da cor sem !important"],
  [VENDA, "  return hex ? hex.slice(1) : null;", "  return hex ? hex.slice(1) : \"\";", "venda: atributo vazio no recibo sem cor"],
  [VENDA, "  return hex ? paletaCabecalhoRecibo(hex).acento : \"#2b6cf0\";", "  return hex ? paletaCabecalhoRecibo(hex).acento : \"#1f63f0\";", "venda: onda padrão trocada"],
  [VENDA, "${C} { background: linear-gradient(115deg, ${p.fundo}, ${p.fundo2}); color: ${p.texto}; }", ".rvn { --rvn-navy: ${p.fundo}; }\n${C} { background: linear-gradient(115deg, ${p.fundo}, ${p.fundo2}); color: ${p.texto}; }", "venda: mexe no --rvn-navy (título do corpo)"],
  [MODELO, "  return cor ? { ...final, corCabecalho: cor } : final;", "  return { ...final, corCabecalho: cor ?? undefined };", "venda: modelo ganha corCabecalho mesmo sem cor"],
  [GRAV, "export const mesclarCoresApp = (cores: ValorCores): Mescla => (atual) => ({ ...atual, ...cores });", "export const mesclarCoresApp = (cores: ValorCores): Mescla => () => ({ ...cores });", "salvar cores do app apaga o resto (bug antigo)"],
  [GRAV, "  return (atual) => ({ ...atual, [CHAVE_COR_CABECALHO_RECIBO]: hex });", "  return () => ({ [CHAVE_COR_CABECALHO_RECIBO]: hex });", "salvar cor do recibo apaga cores do app e tracking"],
  [GRAV, "export const removerCorRecibo: Mescla = (atual) => semChaves(atual, [CHAVE_COR_CABECALHO_RECIBO]);", "export const removerCorRecibo: Mescla = (atual) => ({ ...atual, [CHAVE_COR_CABECALHO_RECIBO]: \"#0a1a3f\" });", "voltar ao padrão grava o azul em vez de remover"],
  [GRAV, ".update({ cores_personalizadas: novo }).eq(\"id\", linha.id);", ".update({ cores_personalizadas: novo }).eq(\"user_id\", userId);", "grava por user_id em vez de id"],
  [GRAV, "  if (error) throw error;\n  const linhas", "  const linhas", "erro de leitura ignorado (gravaria sobre {})"],
  [GRAV, "  \"card_faturamento_to\",\n] as const;", "] as const;", "resetar deixa uma chave do app"],
  [GRAV, "  return linhas.find((l) => l.empresa_id == null) ?? linhas[0];", "  return linhas[0];", "tela mostra a filial em vez da matriz"],
];

const testesFalham = () => spawnSync("node", ["--test", ...TESTES], { cwd: raiz, stdio: "ignore" }).status !== 0;

if (testesFalham()) { console.error("Os testes já falham sem mutante: corrija antes."); process.exit(1); }
let vivos = 0;
for (const [arq, de, para, nome] of MUTANTES) {
  const caminho = join(raiz, arq);
  const original = readFileSync(caminho, "utf8");
  if (!original.includes(de) || de === para) { console.log(`  ? ${nome}: trecho não encontrado`); vivos++; continue; }
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
