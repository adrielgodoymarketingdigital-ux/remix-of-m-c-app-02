// Checagens que fazem o build falhar (scripts/prerender/pluginTopoEstatico.ts → validar),
// sobre cópias adulteradas de um dist/ já gerado.
//
//   npx tsx scripts/testes-landing-prerender/validacaoBuild.ts <dist>
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ARQUIVO_APP, LANDINGS, validar } from "../prerender/pluginTopoEstatico";

const origem = path.resolve(process.argv[2] ?? "dist");
const shell = fs.readFileSync(path.join(origem, ARQUIVO_APP), "utf8");
let falhas = 0;

function caso(nome: string, adulterar: (dist: string) => void, deveFalhar: boolean, motivoEsperado?: RegExp) {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), "topo-estatico-"));
  for (const arquivo of [ARQUIVO_APP, ...LANDINGS.map((l) => l.arquivo)]) {
    fs.mkdirSync(path.dirname(path.join(dist, arquivo)), { recursive: true });
    fs.copyFileSync(path.join(origem, arquivo), path.join(dist, arquivo));
  }
  fs.symlinkSync(path.join(origem, "assets"), path.join(dist, "assets"));
  adulterar(dist);
  let erro: Error | null = null;
  try {
    validar(dist, shell);
  } catch (e) {
    erro = e as Error;
  }
  const ok = deveFalhar ? !!erro && (!motivoEsperado || motivoEsperado.test(erro.message)) : !erro;
  if (!ok) falhas++;
  console.log(`${ok ? "OK  " : "FALHOU"} ${nome}${erro ? ` → ${erro.message}` : ""}`);
  fs.rmSync(dist, { recursive: true, force: true });
}

const editar = (dist: string, arquivo: string, f: (html: string) => string) =>
  fs.writeFileSync(path.join(dist, arquivo), f(fs.readFileSync(path.join(dist, arquivo), "utf8")));

caso("dist intacto passa", () => {}, false);
caso("app.html faltando", (d) => fs.rmSync(path.join(d, ARQUIVO_APP)), true, /app\.html não foi gerado/);
caso("app.html com o bloco da landing", (d) => editar(d, ARQUIVO_APP, (h) => h.replace('<div id="root">', '<div id="topo-estatico"></div><div id="root">')), true, /app\.html/);
caso("app.html sem o pixel da Meta", (d) => editar(d, ARQUIVO_APP, (h) => h.replace("fbq('init'", "fbq('xinit'")), true, /difere do index\.html/);
for (const landing of LANDINGS) {
  caso(`${landing.arquivo} sem <h1>`, (d) => editar(d, landing.arquivo, (h) => h.replace(/<h1[\s\S]*?<\/h1>/, "")), true, /esperado 1 <h1>/);
  caso(`${landing.arquivo} com outro <h1>`, (d) => editar(d, landing.arquivo, (h) => h.replace(/(<h1[^>]*>)/, "$1Outro título ")), true, /não começa com/);
  caso(`${landing.arquivo} faltando`, (d) => fs.rmSync(path.join(d, landing.arquivo)), true, /não foi gerado/);
  caso(`${landing.arquivo} sem o bloco`, (d) => editar(d, landing.arquivo, () => shell), true, /sem o bloco/);
  caso(`${landing.arquivo} com window.__mecUtmify alterado`, (d) => editar(d, landing.arquivo, (h) => h.replace('"/cadastro-plano"', '"/x"')), true, /difere do shell/);
  caso(`${landing.arquivo} usando arquivo inexistente`, (d) => editar(d, landing.arquivo, (h) => h.replace(/(<div id="topo-estatico">)/, '$1<img src="/assets/nao-existe.webp">')), true, /não existe em dist/);
}

console.log(falhas ? `\n${falhas} caso(s) com problema` : "\ntodos os casos ok");
process.exit(falhas ? 1 : 0);
