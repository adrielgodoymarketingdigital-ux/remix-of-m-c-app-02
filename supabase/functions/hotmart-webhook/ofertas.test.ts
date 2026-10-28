// deno test supabase/functions/hotmart-webhook/ofertas.test.ts
// Os códigos de oferta abaixo são inventados para o teste.
import { assertEquals } from "jsr:@std/assert@1";
import { getPlanoFromOfferCode, lerMapaOfertas } from "../_shared/hotmart-config.ts";

Deno.test("mapa válido: cada oferta cai no seu plano", () => {
  const r = lerMapaOfertas('{"teste_mensal":"intermediario_mensal","teste_anual":"profissional_anual"}');
  if (!r.ok) throw new Error(r.erro);
  assertEquals(getPlanoFromOfferCode("teste_mensal", r.mapa), "intermediario_mensal");
  assertEquals(getPlanoFromOfferCode("teste_anual", r.mapa), "profissional_anual");
});

Deno.test("oferta fora do mapa, maiúscula diferente ou com espaço: null", () => {
  const r = lerMapaOfertas('{"teste_mensal":"basico_mensal"}');
  if (!r.ok) throw new Error(r.erro);
  for (const codigo of ["outra", "TESTE_MENSAL", " teste_mensal", "teste_mensal ", ""]) {
    assertEquals(getPlanoFromOfferCode(codigo, r.mapa), null, codigo);
  }
});

Deno.test("chaves herdadas do Object não viram plano", () => {
  const r = lerMapaOfertas('{"teste_mensal":"basico_mensal"}');
  if (!r.ok) throw new Error(r.erro);
  for (const codigo of ["__proto__", "constructor", "toString", "hasOwnProperty", "valueOf"]) {
    assertEquals(getPlanoFromOfferCode(codigo, r.mapa), null, codigo);
  }
});

Deno.test("mapa recusado inteiro quando algo está errado", () => {
  const casos: Array<[string | undefined, string]> = [
    [undefined, "não configurado"],
    ["", "não configurado"],
    ["   ", "não configurado"],
    ["{", "não é um JSON válido"],
    ["teste_mensal=basico_mensal", "não é um JSON válido"],
    ["[]", "precisa ser um objeto"],
    ['["teste_mensal"]', "precisa ser um objeto"],
    ["null", "precisa ser um objeto"],
    ['"basico_mensal"', "precisa ser um objeto"],
    ["42", "precisa ser um objeto"],
    ["{}", "está vazio"],
    ['{"teste_mensal":"premium"}', "plano inválido na entrada 1"],
    ['{"a":"basico_mensal","b":"free"}', "plano inválido na entrada 2"],
    ['{"a":"basico_mensal","b":"demonstracao"}', "plano inválido na entrada 2"],
    ['{"a":"Basico_Mensal"}', "plano inválido na entrada 1"],
    ['{"a":1}', "plano inválido na entrada 1"],
    ['{"a":null}', "plano inválido na entrada 1"],
    ['{"a":["basico_mensal"]}', "plano inválido na entrada 1"],
    ['{"a":"constructor"}', "plano inválido na entrada 1"],
    ['{"":"basico_mensal"}', "código da oferta inválido na entrada 1"],
    ['{" a":"basico_mensal"}', "código da oferta inválido na entrada 1"],
    ['{"SEU_OFFER_CODE_AQUI":"intermediario_mensal"}', "código da oferta inválido na entrada 1"],
  ];
  for (const [bruto, trecho] of casos) {
    const r = lerMapaOfertas(bruto);
    assertEquals(r.ok, false, String(bruto));
    if (!r.ok) assertEquals(r.erro.includes(trecho), true, `${bruto} -> ${r.erro}`);
  }
});

Deno.test("mensagem de erro não repete o código da oferta nem o plano", () => {
  const r = lerMapaOfertas('{"codigo_secreto_123":"plano_errado_xyz"}');
  assertEquals(r.ok, false);
  if (!r.ok) {
    assertEquals(r.erro.includes("codigo_secreto_123"), false);
    assertEquals(r.erro.includes("plano_errado_xyz"), false);
  }
});

Deno.test("todos os 6 planos pagos são aceitos", () => {
  const planos = ["basico_mensal", "intermediario_mensal", "profissional_mensal", "basico_anual", "intermediario_anual", "profissional_anual"];
  const r = lerMapaOfertas(JSON.stringify(Object.fromEntries(planos.map((p, i) => [`o${i}`, p]))));
  if (!r.ok) throw new Error(r.erro);
  planos.forEach((p, i) => assertEquals(getPlanoFromOfferCode(`o${i}`, r.mapa), p));
});
