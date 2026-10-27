// node scripts/testes-i18n/conferirPtBR.mjs [ref=origin/main] [ns...]
// Cada texto pt-BR dos namespaces (padrão: pdv, vendas e comum.formaPagamento)
// tem de existir LETRA POR LETRA no código de <ref> (src/), pedaço a pedaço
// entre as {{variáveis}}. Pega erro de digitação ao mover o texto para o i18n.
// O teste definitivo é o Playwright (HTML igual); este é o rápido.
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import path from "node:path";

const [ref = "origin/main", ...nsArg] = process.argv.slice(2);
const namespaces = nsArg.length ? nsArg : ["pdv", "vendas", "comum"];
const git = (...a) => execFileSync("git", a, { encoding: "utf8", maxBuffer: 1 << 28 });
const arquivos = git("ls-tree", "-r", "--name-only", ref, "src").split("\n").filter((f) => /\.(tsx?|ts)$/.test(f) && !f.startsWith("src/locales/"));
const fonte = arquivos.map((f) => git("show", `${ref}:${f}`)).join("\n");
// Entidades e escapes que o JSX/JS aceitam para o mesmo texto.
const variantes = (t) => [t, t.replace(/"/g, '\\"'), t.replace(/'/g, "\\'"), t.replace(/"/g, "&quot;")];

// Textos que o componente montava em pedaços (plural com "s" condicional,
// concatenação): não existem inteiros no código antigo. Quem prova que ficaram
// iguais é o HTML do Playwright.
const COMPOSTOS = new Set([
  "vendas:aReceber.pendentes_zero", "vendas:aReceber.pendentes_one", "vendas:aReceber.pendentes_other",
]);

let falhas = 0, total = 0, compostos = 0;
const ts = await import("typescript").then((m) => m.default);
for (const ns of namespaces) {
  const arq = path.resolve(`src/locales/pt-BR/${ns}.ts`);
  const js = ts.transpileModule((await import("node:fs")).readFileSync(arq, "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = await import(`data:text/javascript,${encodeURIComponent(js)}`);
  const raiz = ns === "comum" ? { formaPagamento: mod.default.formaPagamento } : mod.default;
  const folhas = [];
  (function andar(o, p) {
    for (const [k, v] of Object.entries(o)) typeof v === "string" ? folhas.push([p + k, v]) : andar(v, `${p}${k}.`);
  })(raiz, "");
  for (const [k, v] of folhas) {
    total++;
    if (COMPOSTOS.has(`${ns}:${k}`)) { compostos++; continue; }
    // Pedaços fixos entre variáveis; formatos do date-fns e textos só de 1 caractere ficam de fora.
    const pedacos = v.split(/\{\{\w+\}\}/).map((p) => p).filter((p) => p.trim().length > 1);
    const faltando = pedacos.filter((p) => !variantes(p).some((x) => fonte.includes(x)) && !variantes(p.trim()).some((x) => fonte.includes(x)));
    if (faltando.length) { falhas++; console.log(`NÃO ACHEI ${ns}:${k} → ${JSON.stringify(faltando)}`); }
  }
}
console.log(`${total} textos conferidos em ${ref} (${compostos} compostos, conferidos pelo HTML), ${falhas} sem correspondência`);
process.exit(falhas ? 1 : 0);
