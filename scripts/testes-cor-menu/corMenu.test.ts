// deno test --no-check --no-lock --allow-read scripts/testes-cor-menu/
// Cor do menu: derivação das variáveis --sidebar-* a partir de UMA cor de fundo
// (src/lib/menu/corMenu.ts). Dados fictícios.
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  CONTRASTE_MINIMO_DESTAQUE,
  CONTRASTE_MINIMO_TEXTO,
  NOMES_VARIAVEIS_MENU,
  VARIAVEIS_MENU_PADRAO,
  contrasteVariaveis as k,
  corMenuDasCores,
  variaveisDoMenu,
} from "../../src/lib/menu/corMenu.ts";

const CORES_TESTE: Record<string, string> = {
  "branco puro": "#ffffff",
  "preto puro": "#000000",
  "cinza médio": "#808080",
  "amarelo claro": "#fff59d",
  "azul saturado": "#1d4ed8",
  "vinho escuro": "#4a0e1c",
};
// Paletas da tela (CorMenu.tsx) + extremos difíceis.
const OUTRAS = ["#1f2937", "#172554", "#4c1d95", "#064e3b", "#c2410c", "#f1f5f9", "#ffff00", "#00ff00", "#ff0000", "#00ffff", "#ff00ff", "#777777", "#767676", "#7f7f7f", "#5a5a5a", "#a0a0a0", "#3b82f6", "#22c55e", "#ef4444", "#f59e0b"];

const FORMATO = /^\d{1,3} \d{1,3}% \d{1,3}%$/;

function conferirContrastes(nome: string, cor: string) {
  const v = variaveisDoMenu(cor);
  assert(v, `${nome}: devolveu null`);
  const msg = (o: string, x: number) => `${nome} (${cor}) ${o}: ${x.toFixed(2)} | ${JSON.stringify(v)}`;
  const texto: [string, string, string][] = [
    ["foreground/background", v.foreground, v.background],
    ["foreground/hover", v.foreground, v.hover],
    ["hover-foreground/hover", v["hover-foreground"], v.hover],
    ["accent-foreground/accent", v["accent-foreground"], v.accent],
    ["accent-foreground/background (título Méc)", v["accent-foreground"], v.background],
    ["muted/background (rótulo de grupo)", v.muted, v.background],
    ["primary-foreground/primary", v["primary-foreground"], v.primary],
  ];
  for (const [o, a, b] of texto) assert(k(a, b) >= CONTRASTE_MINIMO_TEXTO, msg(o, k(a, b)));
  const destaque: [string, string, string][] = [
    ["primary/background", v.primary, v.background],
    ["primary/accent (ícone do item ativo)", v.primary, v.accent],
    ["subtle/background (setas)", v.subtle, v.background],
    ["subtle/hover", v.subtle, v.hover],
  ];
  for (const [o, a, b] of destaque) assert(k(a, b) >= CONTRASTE_MINIMO_DESTAQUE, msg(o, k(a, b)));
  assertEquals(v.ring, v.primary);
  for (const nome of NOMES_VARIAVEIS_MENU) assert(FORMATO.test(v[nome]), `${cor} ${nome} fora do formato: "${v[nome]}"`);
}

for (const [nome, cor] of Object.entries(CORES_TESTE)) {
  Deno.test(`${nome} ${cor}: texto ≥ 4,5 e destaque ≥ 3, formato "H S% L%"`, () => conferirContrastes(nome, cor));
}

Deno.test("paletas da tela e cores difíceis: contraste garantido", () => {
  for (const cor of OUTRAS) conferirContrastes("cor", cor);
});

Deno.test("varredura: 4.096 cores (#rgb) todas com contraste garantido", () => {
  const d = "0123456789abcdef";
  for (const r of d) for (const g of d) for (const b of d) conferirContrastes("varredura", `#${r}${g}${b}`);
});

Deno.test("fundo escuro → texto claro; fundo claro → texto escuro", () => {
  const l = (v: string) => Number(v.split(" ")[2].replace("%", ""));
  assert(l(variaveisDoMenu("#000000")!.foreground) > 50);
  assert(l(variaveisDoMenu("#4a0e1c")!["accent-foreground"]) > 50);
  assert(l(variaveisDoMenu("#ffffff")!.foreground) < 50);
  assert(l(variaveisDoMenu("#fff59d")!["accent-foreground"]) < 50);
  // cinza médio: preto dá mais contraste que branco → texto escuro
  assert(l(variaveisDoMenu("#808080")!.foreground) < 50);
});

Deno.test("destaque de sempre (ciano) mantido quando já contrasta", () => {
  assertEquals(variaveisDoMenu("#000000")!.primary, VARIAVEIS_MENU_PADRAO.primary);
  assertEquals(variaveisDoMenu("#4a0e1c")!.primary, VARIAVEIS_MENU_PADRAO.primary);
  assertEquals(variaveisDoMenu("#1f2937")!.primary, VARIAVEIS_MENU_PADRAO.primary);
  // no branco o ciano não alcança 3:1 → outro tom do mesmo matiz
  const p = variaveisDoMenu("#ffffff")!.primary;
  assert(p !== VARIAVEIS_MENU_PADRAO.primary && p.startsWith("198 "), p);
});

Deno.test("fundo é a própria cor escolhida", () => {
  assertEquals(variaveisDoMenu("#ffffff")!.background, "0 0% 100%");
  assertEquals(variaveisDoMenu("#000000")!.background, "0 0% 0%");
  assertEquals(variaveisDoMenu("#808080")!.background, "0 0% 50%");
  assertEquals(variaveisDoMenu("#1D4ED8")!.background, variaveisDoMenu("#1d4ed8")!.background);
  assertEquals(variaveisDoMenu("#fff")!.background, "0 0% 100%");
});

Deno.test("hex inválido → null (nada aplicado = padrão do CSS)", () => {
  for (const v of ["azul", "#12", "#1234", "#12345", "#1234567", "1d4ed8", "#gggggg", "rgb(0,0,0)", "", " ", null, undefined, 123, {}, [], true, "#1d4ed8;color:red", "#1d4ed8 !important"]) {
    assertEquals(variaveisDoMenu(v), null, `aceitou: ${JSON.stringify(v)}`);
  }
});

Deno.test("padrão do index.css: valores conferidos com src/index.css (claro e .dark)", async () => {
  const css = await Deno.readTextFile(new URL("../../src/index.css", import.meta.url));
  for (const nome of NOMES_VARIAVEIS_MENU) {
    const achados = [...css.matchAll(new RegExp(`--sidebar-${nome}:\\s*([^;]+);`, "g"))].map((m) => m[1].trim());
    assertEquals(achados.length, 2, `--sidebar-${nome} deveria aparecer no :root e no .dark`);
    for (const a of achados) assertEquals(a, VARIAVEIS_MENU_PADRAO[nome], `--sidebar-${nome}`);
  }
});

Deno.test("corMenuDasCores: lê menu_cor de cores_personalizadas", () => {
  assertEquals(corMenuDasCores({ menu_cor: "#1F2937", primary_from: "#000000" }), "#1f2937");
  assertEquals(corMenuDasCores({ primary_from: "#000000" }), null);
  assertEquals(corMenuDasCores({ menu_cor: "vermelho" }), null);
  for (const v of [null, undefined, "x", 1, [], [{ menu_cor: "#000000" }]]) assertEquals(corMenuDasCores(v), null);
});
