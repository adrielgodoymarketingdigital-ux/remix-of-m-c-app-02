// deno test --no-check scripts/testes-recibo-os-layout/
// CSS da compactação do recibo personalizado: nível 0 não acrescenta nada, os
// níveis são cumulativos e só alcançam o recibo do próprio nível, e nenhum
// passa dos mínimos aprovados (texto 8 pt, títulos 8 pt, termo 7,5 pt, ícones
// do checklist 3,2 mm, espaço entre cartões 1,5 mm, espaço interno ≥ 1 mm).
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  CSS_MEDICAO_RECIBO_PERSONALIZADO as cssMedicao,
  CSS_RECIBO_PERSONALIZADO,
  cssAjustesReciboPersonalizado as ajustes,
} from "../../src/components/ordens/recibo-personalizado/cssReciboPersonalizado.ts";

const RECIBO = ".impressao-ordem-container.os-recibo-personalizado";
const SHA256_CSS_DA_MAIN = "ff005970c9ad8a693697f420e0eeabbc93cdc5b4bfe92a13459898b7967e98d0";

interface Regra { seletores: string[]; decl: Map<string, string> }
function regras(texto: string): Regra[] {
  const saida: Regra[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto.replace(/\/\*[\s\S]*?\*\//g, "")))) {
    const decl = new Map<string, string>();
    for (const d of m[2].split(";").map((x) => x.trim()).filter(Boolean)) {
      const i = d.indexOf(":");
      decl.set(d.slice(0, i).trim(), d.slice(i + 1).trim());
    }
    saida.push({ seletores: m[1].split(",").map((s) => s.trim()), decl });
  }
  return saida;
}
/** Regras que só repetem o Tailwind do desenho das avarias (mesmos tamanhos de hoje), fora dos mínimos. */
const ehDesenho = (r: Regra) => r.seletores.every((s) => s.includes(".impressao-silhueta"));
const pt = (v: string) => (v.endsWith("pt") ? parseFloat(v) : v.endsWith("mm") ? parseFloat(v) * (72 / 25.4) : NaN);
const mm = (v: string) => parseFloat(v);
/** Valor que vale para um seletor (a última regra que o declara). */
function valor(css: string, fimSeletor: string, prop: string): string | undefined {
  let achado: string | undefined;
  for (const r of regras(css)) if (r.seletores.some((s) => s.endsWith(fimSeletor)) && r.decl.has(prop)) achado = r.decl.get(prop);
  return achado?.replace(/\s*!important$/, "");
}

Deno.test("o CSS de sempre do recibo continua byte a byte o da main", async () => {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(CSS_RECIBO_PERSONALIZADO));
  assertEquals([...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join(""), SHA256_CSS_DA_MAIN);
});

Deno.test("nível 0 sem agrupamento: nenhum CSS (o recibo fica idêntico)", () => {
  assertEquals(ajustes(0, false), "");
  for (const ruim of [-1, 0.5, NaN]) assertEquals(ajustes(ruim, false), "", `nível ${ruim}`);
});

Deno.test("cada nível só alcança o recibo do próprio nível e é cumulativo", () => {
  for (let n = 1; n <= 3; n++) {
    const css = ajustes(n, false);
    assert(css.length > 0);
    for (const r of regras(css)) {
      for (const s of r.seletores) assert(s.startsWith(`html body ${RECIBO}.osr-compacto.osr-nivel-${n}`), `fora do nível ${n}: ${s}`);
      for (const [p, v] of r.decl) assert(v.endsWith("!important"), `sem !important: ${p}: ${v}`);
    }
  }
  const qtd = (n: number) => regras(ajustes(n, false)).length;
  assert(qtd(1) < qtd(2) && qtd(2) < qtd(3), "níveis cumulativos");
  assertEquals(ajustes(9, false), ajustes(3, false)); // acima do máximo = máximo
});

Deno.test("nível 1 só mexe em espaçamento (fonte igual)", () => {
  for (const r of regras(ajustes(1, false)).filter((r) => !ehDesenho(r))) for (const p of r.decl.keys()) assert(!p.startsWith("font"), `nível 1 mexeu em ${p}`);
  assertEquals(valor(ajustes(1, false), ".osr-compacto.osr-nivel-1", "gap"), "1.5mm");
});

Deno.test("nível 2 diminui os desenhos das avarias", () => {
  assertEquals(valor(ajustes(2, false), ".osr-avarias .impressao-silhueta", "max-width"), "24mm");
  assertEquals(valor(ajustes(1, false), ".osr-avarias .impressao-silhueta", "max-width"), undefined);
});

Deno.test("nível 3: fonte nos mínimos aprovados e não abaixo", () => {
  const css = ajustes(3, false);
  assertEquals(valor(css, ".osr-nivel-3", "font-size"), "8pt");
  assertEquals(valor(css, ".osr-card-titulo", "font-size"), "8pt");
  assertEquals(valor(css, ".osr-termo", "font-size"), "7.5pt");
  assertEquals(valor(css, ".osr-check-icone", "width"), "3.2mm");
  assertEquals(valor(css, ".osr-check-icone", "height"), "3.2mm");
  assertEquals(valor(ajustes(2, false), ".osr-nivel-2", "font-size"), undefined);
  for (const r of regras(css).filter((r) => !ehDesenho(r))) {
    const fs = r.decl.get("font-size");
    if (!fs) continue;
    const limite = r.seletores.some((s) => s.endsWith(".osr-termo")) ? 7.5 : 8;
    assert(pt(fs.replace(/\s*!important$/, "")) >= limite, `fonte abaixo do mínimo: ${r.seletores[0]} ${fs}`);
  }
});

Deno.test("espaços nunca abaixo dos mínimos (1,5 mm entre cartões, ≥ 1 mm dentro)", () => {
  for (let n = 1; n <= 3; n++) {
    const css = ajustes(n, false);
    for (const r of regras(css).filter((r) => !ehDesenho(r))) {
      const gap = r.decl.get("gap");
      if (gap) assert(mm(gap) >= 1.5, `gap < 1,5 mm: ${r.seletores[0]} ${gap}`);
    }
    for (const alvo of [".osr-card-header", ".osr-card-body", ".impressao-block-header", ".impressao-block-content"]) {
      const pad = valor(css, alvo, "padding");
      assert(pad, `${alvo} sem padding no nível ${n}`);
      assert(mm(pad.split(/\s+/)[0]) >= 1, `espaço interno vertical < 1 mm em ${alvo}: ${pad}`);
    }
  }
});

Deno.test("agrupamento: termo + assinaturas (e anterior) inteiros, com o espaço do recibo", () => {
  const css = ajustes(0, true);
  assert(css.length > 0);
  for (const alvo of [".osr-bloco-final", ".osr-bloco-garantia"]) {
    assertEquals(valor(css, alvo, "break-inside"), "avoid");
    assertEquals(valor(css, alvo, "page-break-inside"), "avoid");
    assertEquals(valor(css, alvo, "gap"), "2.5mm");
  }
  for (const r of regras(css)) for (const s of r.seletores) assert(s.startsWith(`html body ${RECIBO}.osr-compacto.osr-nivel-0`), s);
  assertEquals(regras(ajustes(0, false)).length, 0);
  assert(!ajustes(3, false).includes("osr-bloco"), "agrupamento só quando pedido");
});

Deno.test("modo medição: medidas da impressão, só nas cópias .osr-medicao e mais fraco que a compactação", () => {
  const r = regras(cssMedicao);
  assert(r.length >= 3);
  for (const { seletores } of r) for (const s of seletores) assert(s.startsWith(`html ${RECIBO}.osr-medicao`), s);
  assertEquals(valor(cssMedicao, ".osr-medicao", "width"), "194mm");
  assertEquals(valor(cssMedicao, ".osr-medicao", "padding"), "0");
  assertEquals(valor(cssMedicao, ".osr-medicao", "font-size"), "9pt");
  assertEquals(valor(cssMedicao, ".osr-medicao .impressao-silhueta", "max-width"), "28mm"); // index.css @media print
  // "html" + 3 classes < "html body" + 4 classes: a compactação vence o modo medição.
  assert(!cssMedicao.includes("html body"));
});

Deno.test("desenho das avarias: mesmas regras do Tailwind em todo ajuste (Android não tem Tailwind)", () => {
  const esperado: [string, string, string][] = [
    [".impressao-silhueta .absolute", "position", "absolute"],
    [".impressao-silhueta .relative", "position", "relative"],
    [".impressao-silhueta .scale-\\[0\\.85\\]", "transform", "scale(.85)"],
    [".impressao-silhueta .origin-top-left", "transform-origin", "top left"],
    [".impressao-silhueta .p-2", "padding", ".5rem"],
    [".impressao-silhueta .w-2\\.5", "width", ".625rem"],
    [".impressao-silhueta .text-\\[6px\\]", "font-size", "6px"],
    [".impressao-silhueta .flex-wrap", "flex-wrap", "wrap"],
    [".impressao-silhueta .bg-red-500", "background-color", "rgb(239 68 68)"],
    [".impressao-silhueta .bg-blue-500", "background-color", "rgb(59 130 246)"],
  ];
  for (const css of [ajustes(1, false), ajustes(2, false), ajustes(3, false), ajustes(0, true)]) {
    for (const [sel, prop, v] of esperado) assertEquals(valor(css, sel, prop), v, `${sel} ${prop}`);
    assertEquals(valor(css, ".osr-captura .impressao-silhueta", "max-width"), "28mm");
  }
  // a escala escrita à mão não vale na cópia do iPhone (o html2canvas desenha errado; lá há Tailwind)
  for (const r of regras(ajustes(1, false))) {
    if (r.decl.has("transform")) for (const sel of r.seletores) assert(sel.includes(":not(.osr-captura)"), `transform na captura: ${sel}`);
  }
  // o nível 2 continua diminuindo o desenho (vence o limite de 28 mm da captura)
  const n2 = regras(ajustes(2, false));
  const ultimaLargura = n2.filter((r) => r.decl.has("max-width") && r.seletores.some((s) => s.endsWith(".impressao-silhueta"))).pop();
  assertEquals(ultimaLargura?.decl.get("max-width"), "24mm !important");
});
