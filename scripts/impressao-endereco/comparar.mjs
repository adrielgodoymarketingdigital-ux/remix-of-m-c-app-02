// Compara antes × depois (saídas de gerar.tsx + medir.mjs) e falha se:
//   1. qualquer documento mudar de número de páginas (A4 desktop, A4 android, PDF jsPDF);
//   2. o cenário SEM endereço (a) não for idêntico: mesmo HTML byte a byte, mesma
//      posição/tamanho de todos os elementos, mesmo PDF do jsPDF (sem data/ID);
//   3. a altura do conteúdo dos A4 com endereço (b, c, d) mudar (> 0,05 mm) ou o
//      corte do desktop (max-height 277mm) aumentar.
// O cupom 80 mm é bobina (sem folha): só mostra quanto cresceu.
//
//   node comparar.mjs <pasta-antes> <pasta-depois>
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const [antes, depois] = process.argv.slice(2);
const ler = (p) => JSON.parse(readFileSync(p, "utf8"));
const mA = ler(path.join(antes, "medidas.json"));
const mD = ler(path.join(depois, "medidas.json"));
const jA = ler(path.join(antes, "jspdf.json"));
const jD = ler(path.join(depois, "jspdf.json"));

const falhas = [];
const falhar = (msg) => falhas.push(msg);
const TOL = 0.05;

// ── 1 e 3: HTML medido ──────────────────────────────────────────────────────
for (const chave of Object.keys(mA)) {
  const [, , cliente] = chave.split("__");
  if (!mD[chave]) { falhar(`${chave}: falta no depois`); continue; }
  for (const via of Object.keys(mA[chave])) {
    const a = mA[chave][via];
    const d = mD[chave][via];
    if (a.paginas !== d.paginas) falhar(`${chave} [${via}]: páginas ${a.paginas} → ${d.paginas}`);
    if (cliente === "a-sem-endereco") {
      if (JSON.stringify(a.caixas) !== JSON.stringify(d.caixas)) falhar(`${chave} [${via}]: layout sem endereço mudou`);
    } else if (via !== "cupom") {
      if (Math.abs(a.alturaConteudoMm - d.alturaConteudoMm) > TOL) falhar(`${chave} [${via}]: altura ${a.alturaConteudoMm} → ${d.alturaConteudoMm} mm`);
      if (d.cortadoMm > a.cortadoMm + TOL) falhar(`${chave} [${via}]: corte ${a.cortadoMm} → ${d.cortadoMm} mm`);
    }
  }
}

// ── 2: HTML sem endereço byte a byte ────────────────────────────────────────
// O Personalizado leva o próprio CSS num <style> dentro do recibo: o HTML é
// comparado sem os <style>, e o CSS à parte — a única diferença aceita é a
// regra nova .osr-campo-uma-linha (que só vale quando há endereço).
const semStyle = (t) => t.replace(/<style>[\s\S]*?<\/style>/g, "");
const estilos = (t) => (t.match(/<style>[\s\S]*?<\/style>/g) ?? []).join("");
const semRegraNova = (t) => t.replace(/\.impressao-ordem-container\.os-recibo-personalizado \.osr-campo-uma-linha \.osr-valor \{[^}]*\}\s*/g, "");
for (const arq of readdirSync(path.join(antes, "html")).filter((f) => f.includes("__a-sem-endereco"))) {
  const a = readFileSync(path.join(antes, "html", arq), "utf8");
  const d = readFileSync(path.join(depois, "html", arq), "utf8");
  if (semStyle(a) !== semStyle(d)) falhar(`html ${arq}: HTML sem endereço mudou`);
  if (estilos(a) !== semRegraNova(estilos(d))) falhar(`html ${arq}: CSS embutido mudou além da regra nova`);
}

// ── 1 e 2: PDFs do jsPDF ────────────────────────────────────────────────────
// Conteúdo das páginas (streams sem compressão do jsPDF) sem os textos do bloco do cliente.
const forraDoCliente = (buf) =>
  (buf.toString("latin1").match(/stream\n[\s\S]*?endstream/g) ?? [])
    .map((st) => st.replace(/BT\n(?:(?!ET\n)[\s\S])*?\((?:Nome|Telefone|CPF|CNPJ|Endere)(?:(?!ET\n)[\s\S])*?ET\n/g, ""))
    .join("\n");
const semCarimbo = (buf) => buf.toString("latin1").replace(/\/CreationDate \([^)]*\)/g, "").replace(/\/ID \[[^\]]*\]/g, "");
for (const chave of Object.keys(jA)) {
  const a = jA[chave];
  const d = jD[chave];
  if (!d) { falhar(`${chave}: falta no depois`); continue; }
  const cupom = chave.startsWith("cupom__");
  if (a.paginas !== d.paginas) falhar(`pdf ${chave}: páginas ${a.paginas} → ${d.paginas}`);
  if (!cupom && a.alturaMm !== d.alturaMm) falhar(`pdf ${chave}: folha ${a.alturaMm} → ${d.alturaMm} mm`);
  const pa = readFileSync(path.join(antes, "pdf", `${chave}.pdf`));
  const pd = readFileSync(path.join(depois, "pdf", `${chave}.pdf`));
  if (chave.endsWith("__a-sem-endereco")) {
    if (semCarimbo(pa) !== semCarimbo(pd)) falhar(`pdf ${chave}: PDF sem endereço mudou`);
  } else if (!cupom) {
    // A4 com endereço: tirando os textos do bloco do cliente, todo o desenho
    // (posição de cada texto, linha e imagem) tem de ser o mesmo de antes.
    if (forraDoCliente(pa) !== forraDoCliente(pd)) falhar(`pdf ${chave}: desenho fora do bloco do cliente mudou`);
  }
}

// ── Tabela ──────────────────────────────────────────────────────────────────
const CLIENTES = ["a-sem-endereco", "b-curto", "c-longo", "d-so-rua", "e-sem-rua"];
const ROTULO = { "a-sem-endereco": "a", "b-curto": "b", "c-longo": "c", "d-so-rua": "d", "e-sem-rua": "e" };
const series = (prefixo) => [...new Set(Object.keys(mA).map((k) => k.split("__")[1]))].filter((o) => o.startsWith(prefixo)).sort();
const OS_TODAS = [...new Set(Object.keys(mA).map((k) => k.split("__")[1]))];

// Pior caso de cada modelo/caminho: a OS mais alta que, sem endereço, ainda tem
// o mesmo número de páginas da OS normal (= a mais cheia que hoje ainda cabe).
function piorCaso(pegar) {
  const base = pegar("normal", "a-sem-endereco");
  let melhor = null;
  for (const os of OS_TODAS) {
    const m = pegar(os, "a-sem-endereco");
    if (m && m.paginas === base.paginas && (!melhor || m.altura > melhor.altura)) melhor = { os, altura: m.altura };
  }
  return melhor?.os;
}

const linhas = [];
const fmt = (a, d) => `${a}→${d}`;
function linhaTabela(nome, pegarA, pegarD, unidade) {
  const pior = piorCaso(pegarA);
  for (const os of ["normal", pior]) {
    const cel = CLIENTES.map((c) => {
      const a = pegarA(os, c);
      const d = pegarD(os, c);
      return `${ROTULO[c]}: ${fmt(a.paginas, d.paginas)} pág (${fmt(a.altura, d.altura)} ${unidade})`;
    });
    linhas.push(`| ${nome} | ${os === "normal" ? "normal" : `pior caso (${os})`} | ${cel.join(" | ")} |`);
  }
}
for (const modelo of ["padrao", "tech", "personalizado-n0", "personalizado-n1", "personalizado-n2", "personalizado-n3"]) {
  for (const via of ["desktop", "android"]) {
    const pegar = (m) => (os, c) => {
      const x = m[`${modelo}__${os}__${c}`]?.[via];
      return x && { paginas: x.paginas, altura: x.alturaConteudoMm };
    };
    linhaTabela(`${modelo} (${via})`, pegar(mA), pegar(mD), "mm");
  }
}
const pegarPdf = (j, tipo) => (os, c) => {
  const x = j[`${tipo}__${os}__${c}`];
  return x && { paginas: x.paginas, altura: x.alturaMm };
};
linhaTabela("PDF A4 jsPDF (completo)", pegarPdf(jA, "a4"), pegarPdf(jD, "a4"), "mm/folha");
linhaTabela("PDF cupom 80 mm jsPDF", pegarPdf(jA, "cupom"), pegarPdf(jD, "cupom"), "mm de bobina");
const pegarCupom = (m) => (os, c) => {
  const x = m[`cupom__${os}__${c}`]?.cupom;
  return x && { paginas: 1, altura: x.alturaConteudoMm };
};
linhaTabela("Cupom 80 mm HTML", pegarCupom(mA), pegarCupom(mD), "mm de bobina");

console.log("| modelo (caminho) | OS | " + CLIENTES.map((c) => `${ROTULO[c]} (${c})`).join(" | ") + " |");
console.log("|---|---|" + CLIENTES.map(() => "---").join("|") + "|");
console.log(linhas.join("\n"));
console.log(`\nSéries: ${series("cheia").length} OS "cheia" + ${series("leve").length} "leve" + normal; ${Object.keys(mA).length} documentos HTML e ${Object.keys(jA).length} PDFs do jsPDF comparados.`);

// Endereço numa linha só (altura de cada linha de endereço no depois)
const alturasEndereco = new Set();
let cortados = 0;
for (const v of Object.values(mD)) for (const m of Object.values(v)) for (const l of m.linhaEndereco ?? []) {
  alturasEndereco.add(l.alturaMm);
  if (!l.cabe) cortados++;
}
console.log(`Linhas de endereço (A4): alturas distintas ${[...alturasEndereco].sort().join(", ")} mm; ${cortados} com reticências (texto maior que a linha).`);

if (falhas.length) {
  const resumo = {};
  for (const f of falhas) {
    const [chave, resto = ""] = f.split(": ");
    const partes = chave.replace(/^(pdf|html) /, "").split("__");
    const via = (resto.match(/^\[(\w+)\]/) ?? chave.match(/\[(\w+)\]/) ?? [])[1] ?? "";
    const k = `${partes[0]} ${partes[2]?.replace(/ \[.*/, "") ?? ""} ${via}`.trim();
    resumo[k] = (resumo[k] ?? 0) + 1;
  }
  console.log(`\nFALHAS por modelo/cliente/caminho:`);
  for (const [k, n] of Object.entries(resumo).sort()) console.log(`  ${n}× ${k}`);
  console.log(`\nFALHAS (${falhas.length}):`);
  for (const f of falhas.slice(0, 80)) console.log(`  ${f}`);
  process.exit(1);
}
console.log("\nOK: nenhuma página a mais; sem endereço idêntico; A4 com endereço com a mesma altura.");
