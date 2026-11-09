// deno test --no-check --allow-read --allow-env scripts/testes-compat-vidros/
// Layout de computador da Compatibilidade: os textos que já existiam e foram
// para o bloco comum.compatibilidade têm de ser, em pt-BR, LETRA POR LETRA os
// que o celular (e o seletor compartilhado) mostram hoje.
import { assert, assertEquals } from "jsr:@std/assert@1";
import comumPtBR from "../../src/locales/pt-BR/comum.ts";
import comumEs from "../../src/locales/es/comum.ts";

const ler = (caminho: string) => Deno.readTextFileSync(new URL(`../../${caminho}`, import.meta.url));
const pagina = ler("src/pages/CompatibilidadePelicula.tsx");
const seletor = ler("src/components/compatibilidade/SeletorMarcaModeloDados.tsx");
const abas = ler("src/components/compatibilidade/AbasTipoCompatibilidade.tsx");
const c = comumPtBR.compatibilidade;

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
    [c.abaPeliculas, abas],
    [c.abaVidros, abas],
  ];
  for (const [texto, fonte] of casos) assert(fonte.includes(texto), `"${texto}" não está no código de hoje`);
});

Deno.test("plurais novos: zero, um e vários em pt-BR e es", () => {
  assertEquals(
    [c.encontrados_zero, c.encontrados_one, c.encontrados_other, c.grupos_one, c.grupos_other],
    ["Nenhum modelo encontrado", "{{count}} modelo encontrado", "{{count}} modelos encontrados", "Grupo: {{nomes}}", "Grupos: {{nomes}}"],
  );
  const e = comumEs.compatibilidade;
  assertEquals([e.encontrados_zero, e.encontrados_one, e.encontrados_other], ["Ningún modelo encontrado", "{{count}} modelo encontrado", "{{count}} modelos encontrados"]);
});
