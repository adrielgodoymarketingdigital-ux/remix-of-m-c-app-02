// Compara antes × depois (gerar.tsx + medir.mjs) da prova do valor dos produtos.
// Falha (exit 1) se:
//   1. OS sem produto (série semprod, e mista/longo com 0 ou 1 item) não for
//      IDÊNTICA: mesmo HTML byte a byte e mesma posição/tamanho de cada elemento;
//   2. alguma OS que hoje cabe em 1 folha deixar de caber:
//        desktop = 1 página e nada cortado (a OS tem max-height 277 mm e corta);
//        android = 1 página (documento isolado, pode virar 2 folhas);
//        duas OS por folha (Padrão e Tech, vertical/horizontal, desktop/Android) =
//          nada cortado na metade (altura fixa, overflow hidden) e 1 página na amostra;
//        Personalizado automático = primeiro nível 0–3 com altura ≤ 270 mm
//        (LIMITE_UMA_FOLHA_MM); sem nível = 2 folhas.
//
//   3. PDF do jsPDF de OS sem produto não for idêntico (sem data/ID), ou qualquer
//      PDF mudar de páginas. OS antiga (sem preco_total / NaN): mostra antes → depois.
//
//   node comparar.mjs <pasta-antes> <pasta-depois>
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const [antes, depois] = process.argv.slice(2);
const ler = (p) => JSON.parse(readFileSync(p, "utf8"));
const mA = ler(path.join(antes, "medidas.json"));
const mD = ler(path.join(depois, "medidas.json"));
const LIMITE_PERSONALIZADO = 270;

const falhas = [];
const semProduto = (os) => {
  const [tipo, , n] = os.split("-");
  return tipo === "semprod" || Number(n) <= 1;
};
const OS_TODAS = [...new Set(Object.keys(mA).map((k) => k.split("__")[1]))].sort();

// ── 1. Sem produto idêntica ──────────────────────────────────────────────────
let identicas = 0;
for (const arq of readdirSync(path.join(antes, "html"))) {
  const os = arq.replace(/\.html$/, "").split("__")[1];
  if (!semProduto(os)) continue;
  const a = readFileSync(path.join(antes, "html", arq), "utf8");
  const d = readFileSync(path.join(depois, "html", arq), "utf8");
  if (a !== d) falhas.push(`html ${arq}: OS sem produto mudou`);
  else identicas++;
}
for (const chave of Object.keys(mA)) {
  if (!semProduto(chave.split("__")[1])) continue;
  for (const via of Object.keys(mA[chave])) {
    if (JSON.stringify(mA[chave][via]) !== JSON.stringify(mD[chave]?.[via])) falhas.push(`${chave} [${via}]: layout sem produto mudou`);
  }
}

// ── 2. Cabe em 1 folha ──────────────────────────────────────────────────────
const cabe = (m, via) =>
  via.startsWith("duas-") ? m.cortadoMm <= 0.05 && (m.paginas === undefined || m.paginas === 1)
  : via === "desktop" ? m.paginas === 1 && m.cortadoMm <= 0.05
  : m.paginas === 1;
const VIAS = { padrao: ["desktop", "android", "duas-v-desktop", "duas-v-android", "duas-h-desktop", "duas-h-android"], tech: null };
VIAS.tech = VIAS.padrao;
const linhas = [];
const estouros = [];
const MODELOS = ["padrao", "tech", "personalizado-n0", "personalizado-n1", "personalizado-n2", "personalizado-n3"];
for (const modelo of MODELOS) {
  for (const via of VIAS[modelo] ?? ["desktop", "android"]) {
    let total = 0, cabiaA = 0, cabeD = 0, perdeu = 0, ganhou = 0, maisPaginas = 0, maxCresc = 0;
    for (const os of OS_TODAS) {
      const a = mA[`${modelo}__${os}`]?.[via];
      const d = mD[`${modelo}__${os}`]?.[via];
      if (!a || !d) { falhas.push(`${modelo}__${os} [${via}]: medida faltando`); continue; }
      total++;
      const ca = cabe(a, via), cd = cabe(d, via);
      if (ca) cabiaA++;
      if (cd) cabeD++;
      if (d.paginas > a.paginas) maisPaginas++;
      maxCresc = Math.max(maxCresc, d.alturaConteudoMm - a.alturaConteudoMm);
      if (ca && !cd) {
        perdeu++;
        estouros.push(`${modelo} (${via}) ${os}: altura ${a.alturaConteudoMm} → ${d.alturaConteudoMm} mm; ${via === "android" ? `páginas ${a.paginas} → ${d.paginas}` : `cortado ${a.cortadoMm} → ${d.cortadoMm} mm`}`);
      }
      if (!ca && cd) ganhou++;
    }
    linhas.push(`| ${modelo} (${via}) | ${total} | ${cabiaA} → ${cabeD} | ${perdeu} | ${maisPaginas} | +${maxCresc.toFixed(2)} |`);
  }
}

// Personalizado automático (o app escolhe o primeiro nível que cabe em 270 mm)
const nivelAuto = (m, os) => {
  for (let n = 0; n <= 3; n++) {
    const x = m[`personalizado-n${n}__${os}`]?.desktop;
    if (x && x.alturaConteudoMm <= LIMITE_PERSONALIZADO) return n;
  }
  return null;
};
let pTotal = 0, pCabiaA = 0, pCabeD = 0, pPerdeu = 0, pSubiu = 0;
const nivelMudou = [];
for (const os of OS_TODAS) {
  pTotal++;
  const na = nivelAuto(mA, os), nd = nivelAuto(mD, os);
  if (na !== null) pCabiaA++;
  if (nd !== null) pCabeD++;
  if (na !== null && nd === null) {
    pPerdeu++;
    const a3 = mA[`personalizado-n3__${os}`].desktop.alturaConteudoMm, d3 = mD[`personalizado-n3__${os}`].desktop.alturaConteudoMm;
    estouros.push(`personalizado AUTOMÁTICO ${os}: nível ${na} → 2 folhas (nível 3: ${a3} → ${d3} mm, limite ${LIMITE_PERSONALIZADO}; passa ${(d3 - LIMITE_PERSONALIZADO).toFixed(2)} mm)`);
  } else if (na !== null && nd !== null && nd > na) {
    pSubiu++;
    nivelMudou.push(`${os}: n${na} → n${nd}`);
  }
}
linhas.push(`| personalizado AUTOMÁTICO (nível 0–3 ≤ 270 mm; ${pSubiu} OS compactam 1+ nível a mais) | ${pTotal} | ${pCabiaA} → ${pCabeD} | ${pPerdeu} | — | — |`);

// Cupom (bobina): só crescimento
let cupomMax = 0, cupomOs = "";
for (const os of OS_TODAS) {
  const a = mA[`cupom__${os}`]?.cupom, d = mD[`cupom__${os}`]?.cupom;
  if (!a || !d) continue;
  const c = d.alturaConteudoMm - a.alturaConteudoMm;
  if (c > cupomMax) { cupomMax = c; cupomOs = os; }
}

console.log("| modelo (caminho) | OS | cabem antes → depois | cabiam e deixaram de caber | com mais páginas | maior aumento de altura (mm) |");
console.log("|---|---|---|---|---|---|");
console.log(linhas.join("\n"));
console.log(`\nCupom 80 mm (bobina): maior aumento ${cupomMax.toFixed(2)} mm (${cupomOs || "nenhum"}).`);
console.log(`OS sem produto: ${identicas} arquivos HTML idênticos byte a byte (+ layout medido igual).`);
// ── 3. PDFs do jsPDF ────────────────────────────────────────────────────────
const jA = ler(path.join(antes, "jspdf.json"));
const jD = ler(path.join(depois, "jspdf.json"));
const semCarimbo = (buf) => buf.toString("latin1").replace(/\/CreationDate \([^)]*\)/g, "").replace(/\/ID \[[^\]]*\]/g, "");
let pdfIguais = 0, pdfDiferentes = 0, pdfSemProdIguais = 0;
for (const chave of Object.keys(jA)) {
  const os = chave.split("__")[1];
  const a = jA[chave], d = jD[chave];
  if (os.startsWith("antigo-")) {
    console.log(`PDF OS antiga ${chave}: antes ${a.erro ? `ERRO "${a.erro}"` : `${a.paginas} pág${a.nan ? " com NaN" : ""}`} → depois ${d.erro ? `ERRO "${d.erro}"` : `${d.paginas} pág${d.nan ? " com NaN" : ", sem NaN"}`}`);
    if (d.erro || d.nan) falhas.push(`pdf ${chave}: depois ainda ${d.erro ? "quebra" : "tem NaN"}`);
    continue;
  }
  if (a.erro || d.erro) { falhas.push(`pdf ${chave}: erro ${a.erro ?? ""} / ${d.erro ?? ""}`); continue; }
  if (a.paginas !== d.paginas) falhas.push(`pdf ${chave}: páginas ${a.paginas} → ${d.paginas}`);
  const igual = semCarimbo(readFileSync(path.join(antes, "pdf", `${chave}.pdf`))) === semCarimbo(readFileSync(path.join(depois, "pdf", `${chave}.pdf`)));
  if (igual) pdfIguais++; else pdfDiferentes++;
  if (semProduto(os)) { if (igual) pdfSemProdIguais++; else falhas.push(`pdf ${chave}: PDF sem produto mudou`); }
}
console.log(`PDF jsPDF: ${pdfIguais} idênticos (sem data/ID) e ${pdfDiferentes} diferentes; sem produto: ${pdfSemProdIguais} idênticos.`);
if (nivelMudou.length) console.log(`Personalizado que compacta mais: ${nivelMudou.join("; ")}`);

if (estouros.length) {
  console.log(`\nESTOUROS (${estouros.length}):`);
  for (const e of estouros) console.log(`  ${e}`);
}
if (falhas.length) {
  console.log(`\nFALHAS (${falhas.length}):`);
  for (const f of falhas.slice(0, 80)) console.log(`  ${f}`);
}
if (falhas.length || estouros.length) process.exit(1);
console.log("\nOK: nenhuma OS que cabia deixou de caber; OS sem produto idêntica.");
