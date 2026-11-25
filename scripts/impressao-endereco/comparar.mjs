// Compara antes × depois (saídas de gerar.tsx + medir.mjs) e falha se:
//   1. qualquer documento A4 mudar de número de páginas (A4 desktop, A4 android, PDF jsPDF);
//   2. o corte do desktop (max-height 277mm, overflow hidden) ou de uma metade do modo
//      duas OS por folha aumentar — nesses a folha nunca vira 2: o que não cabe some;
//   3. o cenário SEM endereço (a) não for idêntico: mesmo HTML byte a byte, mesma
//      posição/tamanho de todos os elementos, mesmo PDF do jsPDF (sem data/ID).
// Com endereço, a altura PODE mudar (endereço inteiro, quebrando linha; Tel e CPF em
// linhas separadas): a tabela mostra quanto, e o pior caso de cada modelo.
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

// Caminhos em que a folha nunca vira 2 e o que não cabe é cortado: desktop (max-height
// 277 mm) e duas OS por folha (cada metade tem altura fixa, overflow hidden).
const cortaNaFolha = (via) => via === "desktop" || via.startsWith("duas-");
const VIAS = ["desktop", "android", "duas-v-desktop", "duas-v-android", "duas-h-desktop", "duas-h-android"];

const falhas = [];
const falhar = (msg) => falhas.push(msg);
const TOL = 0.05;

// ── 1, 2 e 3: HTML medido ───────────────────────────────────────────────────
for (const chave of Object.keys(mA)) {
  const [, , cliente] = chave.split("__");
  if (!mD[chave]) { falhar(`${chave}: falta no depois`); continue; }
  for (const via of Object.keys(mA[chave])) {
    const a = mA[chave][via];
    const d = mD[chave][via];
    if (a.paginas !== d.paginas) falhar(`${chave} [${via}]: páginas ${a.paginas} → ${d.paginas}`);
    if (cliente === "a-sem-endereco") {
      if (JSON.stringify(a.caixas) !== JSON.stringify(d.caixas)) falhar(`${chave} [${via}]: layout sem endereço mudou`);
    } else if (cortaNaFolha(via) && d.cortadoMm > a.cortadoMm + TOL) {
      falhar(`${chave} [${via}]: corte ${a.cortadoMm} → ${d.cortadoMm} mm`);
    }
  }
}

// ── 3: HTML sem endereço byte a byte ────────────────────────────────────────
// O Personalizado leva o próprio CSS num <style> dentro do recibo: o HTML é
// comparado sem os <style>, e o CSS à parte — a única diferença aceita é a regra
// .osr-campo-uma-linha (a do corte em 1 linha, que saiu) e as da faixa/termo com endereço.
const semStyle = (t) => t.replace(/<style>[\s\S]*?<\/style>/g, "");
const estilos = (t) => (t.match(/<style>[\s\S]*?<\/style>/g) ?? []).join("");
// As regras novas (.osr-faixa-endereco, .osr-termo-com-endereco) só valem com endereço.
const semRegraUmaLinha = (t) => t
  .replace(/\.impressao-ordem-container\.os-recibo-personalizado \.osr-campo-uma-linha \.osr-valor \{[^}]*\}\s*/g, "")
  .replace(/\/\* Endereço do cliente: faixa[^*]*\*\/\s*/g, "")
  .replace(/[^{}]*\.osr-faixa-endereco \{[^}]*\}\s*/g, "")
  .replace(/[^{}]*\.osr-termo\.osr-termo-com-endereco \{[^}]*\}\s*/g, "");
for (const arq of readdirSync(path.join(antes, "html")).filter((f) => f.includes("__a-sem-endereco"))) {
  const a = readFileSync(path.join(antes, "html", arq), "utf8");
  const d = readFileSync(path.join(depois, "html", arq), "utf8");
  if (semStyle(a) !== semStyle(d)) falhar(`html ${arq}: HTML sem endereço mudou`);
  const semEspacos = (t) => semRegraUmaLinha(t).replace(/\s+/g, "");
  if (semEspacos(estilos(a)) !== semEspacos(estilos(d))) falhar(`html ${arq}: CSS embutido mudou além da regra do corte`);
}

// ── 1 e 3: PDFs do jsPDF ────────────────────────────────────────────────────
const semCarimbo = (buf) => buf.toString("latin1").replace(/\/CreationDate \([^)]*\)/g, "").replace(/\/ID \[[^\]]*\]/g, "");
for (const chave of Object.keys(jA)) {
  const a = jA[chave];
  const d = jD[chave];
  if (!d) { falhar(`${chave}: falta no depois`); continue; }
  const cupom = chave.startsWith("cupom__");
  if (!cupom && a.paginas !== d.paginas) falhar(`pdf ${chave}: páginas ${a.paginas} → ${d.paginas}`);
  if (!cupom && a.alturaMm !== d.alturaMm) falhar(`pdf ${chave}: folha ${a.alturaMm} → ${d.alturaMm} mm`);
  if (chave.endsWith("__a-sem-endereco")) {
    const pa = readFileSync(path.join(antes, "pdf", `${chave}.pdf`));
    const pd = readFileSync(path.join(depois, "pdf", `${chave}.pdf`));
    if (semCarimbo(pa) !== semCarimbo(pd)) falhar(`pdf ${chave}: PDF sem endereço mudou`);
  }
}

// ── Tabela: modelo × cenário ────────────────────────────────────────────────
const CLIENTES = ["a-sem-endereco", "b-curto", "f-longo-2l", "c-longo", "d-so-rua", "e-sem-rua"];
const OS_TODAS = [...new Set(Object.keys(mA).map((k) => k.split("__")[1]))].sort();

// Linhas do endereço no depois (por modelo/caminho/cliente).
const linhasEndereco = (modelo, via, cliente) => {
  const s = new Set();
  for (const os of OS_TODAS) for (const l of mD[`${modelo}__${os}__${cliente}`]?.[via]?.linhaEndereco ?? []) s.add(l.linhas);
  return [...s].sort().join("/") || "–";
};

// Para cada modelo/caminho/cliente:
//   OS em 1 folha antes → depois = quantas OS cabem em 1 folha antes e depois
//                                  (desktop: "cabe" = nada cortado pelo max-height de 277 mm);
//   estouraram                   = nº de OS que cabiam antes e não cabem depois;
//   pior caso                    = a OS mais alta que ANTES cabia em 1 folha: altura antes → depois.
// Duas OS: o PDF só é impresso numa amostra; nos outros, "cabe" = nada cortado.
const cabeEm1 = (x) => (x.paginas === undefined || x.paginas === 1) && (x.corte === undefined || x.corte <= TOL);
function linhaModelo(rotulo, pegarA, pegarD, unidade, extra) {
  const linhas = [];
  for (const c of CLIENTES) {
    const um = [0, 0];
    let mudou = 0;
    let pior = null;
    for (const os of OS_TODAS) {
      const a = pegarA(os, c);
      const d = pegarD(os, c);
      if (!a || !d) continue;
      if (cabeEm1(a)) um[0]++;
      if (cabeEm1(d)) um[1]++;
      if (cabeEm1(a) && !cabeEm1(d)) mudou++;
      if (cabeEm1(a) && (!pior || a.altura > pior.a.altura)) pior = { os, a, d };
    }
    const delta = pior ? pior.d.altura - pior.a.altura : 0;
    const piorTxt = pior ? `${pior.os}: ${pior.a.altura}→${pior.d.altura} ${unidade} (${delta >= 0 ? "+" : ""}${delta.toFixed(2)})` : "–";
    linhas.push(`| ${rotulo} | ${c} | ${um[0]}→${um[1]} | ${mudou} | ${piorTxt} | ${extra(c, pior)} |`);
  }
  return linhas;
}

const tabela = [];
for (const modelo of ["padrao", "tech", "personalizado-n0", "personalizado-n1", "personalizado-n2", "personalizado-n3"]) {
  for (const via of VIAS) {
    const pegar = (m) => (os, c) => {
      const x = m[`${modelo}__${os}__${c}`]?.[via];
      return x && { paginas: x.paginas, altura: x.alturaConteudoMm, ...(cortaNaFolha(via) ? { corte: x.cortadoMm } : {}) };
    };
    tabela.push(...linhaModelo(`${modelo} (${via})`, pegar(mA), pegar(mD), "mm", (c, pior) => {
      const corte = cortaNaFolha(via) && pior ? `${pior.a.corte}→${pior.d.corte}` : "–";
      return `${linhasEndereco(modelo, via, c)} | ${corte}`;
    }));
  }
}
// PDF A4 do jsPDF (completo): já sai com 2+ folhas (termo); conta folhas antes → depois.
for (const c of CLIENTES) {
  const dist = {};
  for (const os of OS_TODAS) {
    const k = `a4__${os}__${c}`;
    const t = `${jA[k].paginas}→${jD[k].paginas}`;
    dist[t] = (dist[t] ?? 0) + 1;
  }
  const mudou = OS_TODAS.filter((os) => jA[`a4__${os}__${c}`].paginas !== jD[`a4__${os}__${c}`].paginas).length;
  tabela.push(`| PDF A4 jsPDF (completo) | ${c} | folhas: ${Object.entries(dist).map(([t, n]) => `${n}× ${t}`).join(", ")} | ${mudou} | – | – | – |`);
}

console.log(`| modelo (caminho) | cliente | OS em 1 folha antes→depois (de ${OS_TODAS.length}) | OS que cabiam e passaram a não caber | pior caso: OS mais alta que antes cabia em 1 folha, altura antes→depois | linhas do endereço (depois) | corte do pior caso antes→depois (mm; desktop e duas OS) |`);
console.log("|---|---|---|---|---|---|---|");
console.log(tabela.join("\n"));

// Cupom (bobina): só cresce.
const cres = (pegarA, pegarD) => CLIENTES.map((c) => `${c}: ${pegarA("normal", c)}→${pegarD("normal", c)}`).join("; ");
const alturaCupomHtml = (m) => (os, c) => m[`cupom__${os}__${c}`]?.cupom?.alturaConteudoMm;
const alturaCupomPdf = (j) => (os, c) => j[`cupom__${os}__${c}`]?.alturaMm;
console.log(`\nCupom 80 mm HTML (OS normal, mm de bobina): ${cres(alturaCupomHtml(mA), alturaCupomHtml(mD))}`);
console.log(`Cupom 80 mm PDF (OS normal, mm de bobina): ${cres(alturaCupomPdf(jA), alturaCupomPdf(jD))}`);

let cortados = 0;
for (const v of Object.values(mD)) for (const m of Object.values(v)) for (const l of m.linhaEndereco ?? []) if (!l.cabe) cortados++;
console.log(`Endereço com reticências/corte (texto maior que a caixa) no depois: ${cortados}.`);
console.log(`${Object.keys(mA).length} documentos HTML e ${Object.keys(jA).length} PDFs do jsPDF comparados.`);

if (falhas.length) {
  console.log(`\nFALHAS (${falhas.length}):`);
  for (const f of falhas.slice(0, 150)) console.log(`  ${f}`);
  process.exit(1);
}
console.log("\nOK: nenhuma página a mais, nenhum corte a mais no desktop; sem endereço idêntico.");
