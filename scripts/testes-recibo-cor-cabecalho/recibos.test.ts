// node --test scripts/testes-recibo-cor-cabecalho/
// Os dois recibos: sem cor escolhida, CSS e modelo IGUAIS aos da origin/main;
// com cor, só o cabeçalho muda (e --rvn-navy nunca). Dados fictícios.
import { test } from "node:test";
import assert from "node:assert/strict";
import { importarDaMain } from "./apoio.ts";
import * as os from "../../src/components/ordens/recibo-personalizado/cssReciboPersonalizado.ts";
import * as venda from "../../src/components/vendas/recibo-novo/cssReciboVendaNovo.ts";
import { montarReciboVenda } from "../../src/lib/vendas/reciboVendaModelo.ts";
import { CENARIOS } from "../../src/dev/reciboVendaNovo/cenarios.ts";

type ModOS = typeof os;
type ModVenda = typeof venda;
type ModModelo = { montarReciboVenda: typeof montarReciboVenda };

const INVALIDAS = [null, undefined, "", "azul", "#12", "rgb(0,0,0)", "#1d4ed8;color:red"];

test("OS: CSS do recibo e da compactação idênticos aos da main", async () => {
  const main = await importarDaMain<ModOS>("src/components/ordens/recibo-personalizado/cssReciboPersonalizado.ts");
  assert.equal(os.CSS_RECIBO_PERSONALIZADO, main.CSS_RECIBO_PERSONALIZADO);
  assert.equal(os.CSS_MEDICAO_RECIBO_PERSONALIZADO, main.CSS_MEDICAO_RECIBO_PERSONALIZADO);
  for (const nivel of [0, 1, 2, 3]) for (const ag of [false, true]) {
    assert.equal(os.cssAjustesReciboPersonalizado(nivel, ag), main.cssAjustesReciboPersonalizado(nivel, ag));
  }
});

test("OS: sem cor válida, nenhum CSS a mais", () => {
  for (const c of INVALIDAS) assert.equal(os.cssCorCabecalhoReciboPersonalizado(c as string), "", String(c));
});

test("OS: com cor, só regras do cabeçalho, no escopo do recibo e com !important", () => {
  const css = os.cssCorCabecalhoReciboPersonalizado("#7F1D1D");
  assert.match(css, /\.osr-header \{ background: linear-gradient\(135deg, #7f1d1d 0%, #6c1919 100%\) !important; color: #ffffff !important; \}/);
  const regras = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  assert.ok(regras.length >= 6);
  for (const [, sel, corpo] of regras) {
    for (const parte of sel.split(",")) assert.match(parte.trim(), /^\.impressao-ordem-container\.os-recibo-personalizado \.osr-(header|logo-box|logo-nome|titulo|loja-nome|loja-linha svg|numero|data-status|status|loja)$/);
    for (const decl of corpo.split(";").map((d) => d.trim()).filter(Boolean)) assert.match(decl, /!important$/, decl);
  }
  // Cor clara: texto escuro.
  assert.match(os.cssCorCabecalhoReciboPersonalizado("#fde68a"), /\.osr-titulo[^{]*\{ color: #0f172a !important; \}/);
});

test("venda: CSS do recibo idêntico ao da main (tela e impressão)", async () => {
  const main = await importarDaMain<ModVenda>("src/components/vendas/recibo-novo/cssReciboVendaNovo.ts");
  assert.equal(venda.cssReciboVendaNovo(), main.cssReciboVendaNovo());
  assert.equal(venda.cssReciboVendaNovo({ paraImpressao: true }), main.cssReciboVendaNovo({ paraImpressao: true }));
});

test("venda: sem cor válida, sem atributo, sem CSS e onda no azul de sempre", () => {
  for (const c of INVALIDAS) {
    assert.equal(venda.atributoCorCabecalho(c as string), null);
    assert.equal(venda.cssCorCabecalhoReciboVendaNovo(c as string), "");
    assert.equal(venda.corOndaCabecalho(c as string), "#2b6cf0");
  }
});

test("venda: com cor, regras só do cabeçalho com aquela cor; --rvn-navy intocado", () => {
  const css = venda.cssCorCabecalhoReciboVendaNovo("#7f1d1d");
  assert.equal(venda.atributoCorCabecalho("#7F1D1D"), "7f1d1d");
  assert.ok(!css.includes("--rvn"), "não mexe nas variáveis do recibo");
  for (const [, sel] of css.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    for (const parte of sel.split(",")) assert.ok(parte.trim().startsWith('.rvn-cab[data-rvn-cor="7f1d1d"]'), parte);
  }
  assert.match(css, /background: linear-gradient\(115deg, #7f1d1d, #6c1919\); color: #ffffff;/);
  assert.notEqual(venda.corOndaCabecalho("#7f1d1d"), "#2b6cf0");
  assert.match(venda.cssCorCabecalhoReciboVendaNovo("#fde68a"), /color: #0f172a;/);
});

const comCores = (entrada: (typeof CENARIOS)[number]["entrada"], cores: unknown) => ({ ...entrada, loja: { ...entrada.loja, cores_personalizadas: cores } });

test("venda: sem cor escolhida, o modelo é IDÊNTICO ao da main em todos os cenários", async () => {
  const main = await importarDaMain<ModModelo>("src/lib/vendas/reciboVendaModelo.ts");
  assert.ok(CENARIOS.length >= 8);
  for (const c of CENARIOS) {
    const esperado = main.montarReciboVenda(c.entrada);
    assert.deepStrictEqual(montarReciboVenda(c.entrada), esperado, c.id);
    for (const cores of [null, {}, { tracking_config: { mostrar_fotos: true }, primary_from: "#000000" }, { recibo_cabecalho_cor: "azul" }, [1]]) {
      const m = montarReciboVenda(comCores(c.entrada, cores));
      assert.deepStrictEqual(m, main.montarReciboVenda(comCores(c.entrada, cores)), `${c.id} ${JSON.stringify(cores)}`);
      assert.ok(!("corCabecalho" in m), "sem a chave corCabecalho");
    }
  }
});

test("venda: com cor, o modelo é o da main + corCabecalho (também com personalização do recibo)", async () => {
  const main = await importarDaMain<ModModelo>("src/lib/vendas/reciboVendaModelo.ts");
  for (const c of CENARIOS) {
    const e = comCores(c.entrada, { recibo_cabecalho_cor: "#7F1D1D" });
    assert.deepStrictEqual(montarReciboVenda(e), { ...main.montarReciboVenda(e), corCabecalho: "#7f1d1d" }, c.id);
    const cfg = { blocos: { logo: false } };
    assert.deepStrictEqual(montarReciboVenda(e, cfg), { ...main.montarReciboVenda(e, cfg), corCabecalho: "#7f1d1d" }, `${c.id} com config`);
  }
});
