// deno test --no-check --allow-read --allow-env scripts/testes-compat-vidros/
// Layout de computador da Compatibilidade: os textos que já existiam e foram
// para o bloco comum.compatibilidade têm de ser, em pt-BR, LETRA POR LETRA os
// que o celular (e o seletor compartilhado) mostram hoje; o es tem de ter as
// mesmas chaves e as mesmas {{variáveis}}, tratando por "usted".
import { assert, assertEquals } from "jsr:@std/assert@1";
import comumPtBR from "../../src/locales/pt-BR/comum.ts";
import comumEs from "../../src/locales/es/comum.ts";

const ler = (caminho: string) => Deno.readTextFileSync(new URL(`../../${caminho}`, import.meta.url));
const pagina = ler("src/pages/CompatibilidadePelicula.tsx");
const seletor = ler("src/components/compatibilidade/SeletorMarcaModeloDados.tsx");
const abas = ler("src/components/compatibilidade/AbasTipoCompatibilidade.tsx");
const c = comumPtBR.compatibilidade;
const e = comumEs.compatibilidade;

type Arvore = { [chave: string]: string | Arvore };
/** Folhas da árvore como "a.b.c" → texto. */
function folhas(arvore: Arvore, prefixo = ""): Map<string, string> {
  const saida = new Map<string, string>();
  for (const [k, v] of Object.entries(arvore)) {
    if (typeof v === "string") saida.set(prefixo + k, v);
    else for (const [kk, vv] of folhas(v, `${prefixo}${k}.`)) saida.set(kk, vv);
  }
  return saida;
}
const variaveis = (texto: string) => [...texto.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort();

Deno.test("textos reaproveitados: pt-BR igual ao texto de hoje", () => {
  const casos: [string, string][] = [
    [c.titulo, pagina],
    [c.subtitulo, pagina],
    [c.carregando, pagina],
    [c.erro, pagina],
    [c.buscarModelo, pagina],
    [c.semCadastro, pagina],
    [c.selecioneMarca, seletor],
    [c.selecioneModelo, seletor],
    [c.buscaMarca, seletor],
    [c.buscaModelo, seletor],
    [c.nenhumaOpcao, seletor],
    [c.abaPeliculas, abas],
    [c.abaVidros, abas],
  ];
  for (const [texto, fonte] of casos) assert(fonte.includes(texto), `"${texto}" não está no código de hoje`);
});

Deno.test("textos por tipo: pt-BR = TEXTOS da página (película e vidro)", () => {
  for (const tipo of ["pelicula", "vidro"] as const) {
    const t = c.porTipo[tipo];
    for (const texto of [t.descricaoBusca, t.tituloResultado, t.semDados]) {
      assert(pagina.includes(`"${texto}"`), `${tipo}: "${texto}" não está no TEXTOS da página`);
    }
    // Celular: `${marca} ${modelo} ${usaOMesmo}:`  →  computador: "{{marca}} {{modelo}} <usaOMesmo>:"
    const prefixo = "{{marca}} {{modelo}} ";
    assert(t.usaOMesmo.startsWith(prefixo) && t.usaOMesmo.endsWith(":"), t.usaOMesmo);
    const meio = t.usaOMesmo.slice(prefixo.length, -1);
    assert(pagina.includes(`usaOMesmo: "${meio}"`), `${tipo}: "${meio}" não é o usaOMesmo do TEXTOS`);
  }
});

Deno.test("pt-BR e es: mesmas chaves e mesmas {{variáveis}} no bloco compatibilidade", () => {
  const pt = folhas(c as unknown as Arvore);
  const es = folhas(e as unknown as Arvore);
  assertEquals([...es.keys()].sort(), [...pt.keys()].sort());
  for (const [chave, texto] of pt) {
    assert(es.get(chave)!.trim().length > 0, `es vazio em ${chave}`);
    assertEquals(variaveis(es.get(chave)!), variaveis(texto), `variáveis diferentes em ${chave}`);
  }
  // As chaves por tipo que o componente lê existem nos dois tipos.
  for (const tipo of ["pelicula", "vidro"]) {
    for (const k of ["descricaoBusca", "tituloResultado", "usaOMesmo", "semDados"]) assert(pt.has(`porTipo.${tipo}.${k}`), `${tipo}.${k}`);
  }
});

Deno.test("es do bloco compatibilidade: usted (sem imperativo de tú) e sem português", () => {
  const textos = [...folhas(e as unknown as Arvore).values()].join("\n");
  for (const tu of [/\bDescubre\b/, /\bSelecciona\b/, /\bInténtalo\b/, /\bBusca\b/, /\btu\b/i, /\bpuedes\b/i]) {
    assert(!tu.test(textos), `tratamento por tú: ${tu}`);
  }
  for (const pt of [/ção\b/, /ções\b/, /\bvocê\b/i, /\bnão\b/i, /\bpelícula/i, /\bvidro\b/i, /\bcompatíve/i, /\bnenhum/i]) {
    assert(!pt.test(textos), `texto em português no es: ${pt}`);
  }
});

Deno.test("plurais novos: zero, um e vários em pt-BR e es", () => {
  assertEquals(
    [c.encontrados_zero, c.encontrados_one, c.encontrados_other, c.grupos_one, c.grupos_other],
    ["Nenhum modelo encontrado", "{{count}} modelo encontrado", "{{count}} modelos encontrados", "Grupo: {{nomes}}", "Grupos: {{nomes}}"],
  );
  assertEquals([e.encontrados_zero, e.encontrados_one, e.encontrados_other], ["Ningún modelo encontrado", "{{count}} modelo encontrado", "{{count}} modelos encontrados"]);
});
