// Formatadores centrais nos motores de verdade: Node, Chromium e WebKit (o
// Intl de cada um vem de um ICU/CLDR diferente). Roda os casos de
// sinalNegativo.casos.json e os de COP, CLP e ZZ da P1 e falha se qualquer
// motor der outra saída.
//
//   PLAYWRIGHT_PATH=<.../node_modules/playwright> node scripts/testes-i18n/formatadoresNavegador.playwright.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH ?? "playwright");
const esbuild = require("esbuild");
const aqui = path.dirname(fileURLToPath(import.meta.url));

const { outputFiles } = await esbuild.build({
  stdin: {
    contents: 'import { formatarMoeda } from "../../src/lib/i18n/formatadores.ts"; globalThis.formatarMoeda = formatarMoeda;',
    resolveDir: aqui,
    loader: "ts",
  },
  bundle: true,
  format: "iife",
  write: false,
});
const pacote = outputFiles[0].text;

const N = " ";
const es = (pais, moeda, fuso) => ({ idioma: "es", moeda, pais, fuso });
const casos = [
  ...JSON.parse(readFileSync(path.join(aqui, "sinalNegativo.casos.json"), "utf8")).casos,
  // P1: COP sem centavos (o WebKit daria 2 casas sem a tabela), CLP, Otro país em es-419
  { ctx: es("CO", "COP", "America/Bogota"), valor: "1234567.891", esperado: `$${N}1.234.568` },
  { ctx: es("CL", "CLP", "America/Santiago"), valor: "1234567.891", esperado: "$1.234.568" },
  { ctx: es("ZZ", "USD", "America/New_York"), valor: "1234567.891", esperado: `US$${N}1,234,567.89` },
];

// Roda dentro do motor: devolve a saída de cada caso e, para pt-BR, a do Intl puro.
function rodarCasos(lista) {
  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  return lista.map((c) => ({
    obtido: globalThis.formatarMoeda(Number(c.valor), c.ctx),
    esperado: c.esperado ?? brl.format(Number(c.valor)),
  }));
}

const motores = {};
{
  const ctx = vm.createContext({ Intl, Number, Map, JSON, Date });
  ctx.globalThis = ctx;
  vm.runInContext(pacote, ctx);
  motores[`node ${process.version} (ICU ${process.versions.icu})`] = vm.runInContext(`(${rodarCasos})(${JSON.stringify(casos)})`, ctx);
}
for (const nome of ["chromium", "webkit"]) {
  const navegador = await pw[nome].launch();
  const pagina = await navegador.newPage();
  await pagina.setContent("<html><body></body></html>");
  await pagina.addScriptTag({ content: pacote });
  motores[`${nome} ${navegador.version()}`] = await pagina.evaluate(`(${rodarCasos})(${JSON.stringify(casos)})`);
  await navegador.close();
}

const mostrar = (s) => s.replace(/ /g, "⍽");
let falhas = 0;
for (const [motor, resultados] of Object.entries(motores)) {
  const erradas = resultados.map((r, i) => ({ ...r, caso: casos[i] })).filter((r) => r.obtido !== r.esperado);
  falhas += erradas.length;
  console.log(`${erradas.length ? "FALHOU" : "ok    "} ${motor}: ${resultados.length - erradas.length}/${resultados.length}`);
  for (const r of erradas) {
    console.log(`   ${r.caso.ctx.idioma} ${r.caso.ctx.pais} ${r.caso.ctx.moeda} ${r.caso.valor}: obtido ${mostrar(r.obtido)} · esperado ${mostrar(r.esperado)}`);
  }
}
process.exit(falhas ? 1 : 0);
