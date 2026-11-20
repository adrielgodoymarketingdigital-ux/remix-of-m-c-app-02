// deno test --no-check scripts/testes-minhas-garantias/
// "Minhas garantias" (fase A): prévia do termo e funções iguais às do recibo novo.
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  ajustarTextoTermoGarantia,
  DADOS_EXEMPLO_GARANTIA,
  formatarMesesGarantiaTexto,
  previaTextoGarantia,
  rotuloPrazo,
  VARIAVEIS_GARANTIA,
} from "../../src/lib/garantias/previa.ts";
import { TEXTO_PADRAO_COM_GARANTIA, TEXTO_PADRAO_SEM_GARANTIA } from "../../src/lib/garantias/textoPadrao.ts";
import { ajustarTextoTermo, formatarMesesGarantia } from "../../src/lib/vendas/reciboVendaModelo.ts";

Deno.test("formatarMesesGarantiaTexto é idêntica à do recibo novo (0 a 120)", () => {
  for (let m = 0; m <= 120; m++) assertEquals(formatarMesesGarantiaTexto(m), formatarMesesGarantia(m), `meses=${m}`);
  assertEquals([1, 3, 12, 18, 24].map(formatarMesesGarantiaTexto), ["1 mês", "3 meses", "1 ano", "18 meses", "2 anos"]);
});

Deno.test("ajustarTextoTermoGarantia é idêntica à do recibo novo", () => {
  const amostras = [
    TEXTO_PADRAO_COM_GARANTIA,
    TEXTO_PADRAO_SEM_GARANTIA,
    "Valor pago: {{valor}}\nValor pago  :  {{valor}}\nVALOR PAGO:{{valor}}",
    "({{garantia_meses}} meses) e {{garantia_meses}}   meses e {{garantia_meses}} MESES e {{garantia_meses}} mesesx",
    "",
  ];
  for (const t of amostras) assertEquals(ajustarTextoTermoGarantia(t), ajustarTextoTermo(t));
});

Deno.test("prévia do padrão com garantia: sem variável sobrando, prazo certo, sem 'meses meses'", () => {
  for (const [m, rotulo] of [[3, "3 meses"], [6, "6 meses"], [12, "1 ano"], [18, "18 meses"]] as const) {
    const p = previaTextoGarantia(TEXTO_PADRAO_COM_GARANTIA, m);
    assert(!p.includes("{{"), `sem variável sobrando (${m})`);
    assert(p.includes(`1. GARANTIA CONTRATUAL (${rotulo})`), `prazo no título (${m})`);
    assert(p.includes(`Garantia de ${rotulo} a partir`), `prazo no texto (${m})`);
    assert(!/meses meses|ano meses/.test(p));
    assert(p.includes(`Nome: ${DADOS_EXEMPLO_GARANTIA.cliente}`) && p.includes(`IMEI: ${DADOS_EXEMPLO_GARANTIA.imei}`));
  }
});

Deno.test("prévia do padrão sem garantia: mantém o aviso dos 90 dias do CDC", () => {
  const p = previaTextoGarantia(TEXTO_PADRAO_SEM_GARANTIA, 0);
  assert(p.includes("A garantia legal de 90 dias prevista no CDC"));
  assert(!p.includes("{{"));
});

Deno.test("prévia de texto antigo importado: '{{garantia_meses}} meses' sai sem repetir, como no recibo novo", () => {
  const antigo = "2. GARANTIA CONTRATUAL ({{garantia_meses}} meses)\nValor pago: {{valor}}";
  assertEquals(previaTextoGarantia(antigo, 3), `2. GARANTIA CONTRATUAL (3 meses)\nValor do produto: ${DADOS_EXEMPLO_GARANTIA.valor}`);
});

Deno.test("prévia usa os dados da loja quando vierem, e os de exemplo quando não", () => {
  const t = "{{loja}} | {{loja_cnpj}} | {{loja_telefone}} | {{loja_endereco}}";
  assertEquals(previaTextoGarantia(t, 0, { nome_loja: "Minha Loja", cnpj: " ", telefone: null }),
    `Minha Loja | ${DADOS_EXEMPLO_GARANTIA.loja_cnpj} | ${DADOS_EXEMPLO_GARANTIA.loja_telefone} | ${DADOS_EXEMPLO_GARANTIA.loja_endereco}`);
  assertEquals(previaTextoGarantia(t, 0), `${DADOS_EXEMPLO_GARANTIA.loja} | ${DADOS_EXEMPLO_GARANTIA.loja_cnpj} | ${DADOS_EXEMPLO_GARANTIA.loja_telefone} | ${DADOS_EXEMPLO_GARANTIA.loja_endereco}`);
});

Deno.test("todas as variáveis da lista são trocadas na prévia", () => {
  const p = previaTextoGarantia(VARIAVEIS_GARANTIA.map((v) => v.tag).join("\n"), 6);
  assert(!p.includes("{{"), p);
  assertEquals(VARIAVEIS_GARANTIA.length, 16);
});

Deno.test("rótulo do prazo na lista", () => {
  assertEquals([0, 1, 3, 12, 24].map(rotuloPrazo), ["—", "1 mês", "3 meses", "1 ano", "2 anos"]);
});
