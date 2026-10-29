// deno test --no-check scripts/testes-recibo-os-layout/
// CSS do recibo personalizado: só alcança o próprio recibo, toda declaração com
// !important e nada externo (sem @import, url() ou fonte nova).
import { assert, assertEquals } from "jsr:@std/assert@1";
import { CSS_RECIBO_PERSONALIZADO as css } from "../../src/components/ordens/recibo-personalizado/cssReciboPersonalizado.ts";

const ESCOPO = ".impressao-ordem-container.os-recibo-personalizado";

function regras(texto: string): { seletor: string; corpo: string }[] {
  const semComentarios = texto.replace(/\/\*[\s\S]*?\*\//g, "");
  const saida: { seletor: string; corpo: string }[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(semComentarios))) saida.push({ seletor: m[1].trim(), corpo: m[2] });
  return saida;
}

Deno.test("todo seletor fica dentro do recibo personalizado", () => {
  const lista = regras(css);
  assert(lista.length > 50);
  for (const { seletor } of lista) {
    const limpo = seletor.replace(/^@media print\s*\{?\s*/, "");
    for (const parte of limpo.split(",")) assert(parte.trim().startsWith(ESCOPO), `fora do escopo: ${parte}`);
  }
});

Deno.test("toda declaração com !important", () => {
  for (const { corpo } of regras(css)) {
    for (const decl of corpo.split(";").map((d) => d.trim()).filter(Boolean)) {
      assert(decl.endsWith("!important"), `sem !important: ${decl}`);
      assertEquals(decl.match(/!important/g)?.length, 1, decl);
    }
  }
});

Deno.test("nada externo e a fonte de sempre", () => {
  assert(!/@import|url\(|@font-face|googleapis|Inter/i.test(css));
  assert(css.includes("font-family: Arial, Helvetica, sans-serif !important"));
  assert(css.includes("print-color-adjust: exact !important"));
  assert(css.includes("max-height: none !important"));
});
