// deno test --no-check --allow-read=src --config scripts/testes-caixa-desconto/deno.json scripts/testes-caixa-desconto/
// Desconto no caixa (Fase 1): agruparVendasPorFormaPagamento abate o desconto
// da 1ª forma; valorLiquidoVenda/descontoDaVenda. Dados fictícios; sem rede.
// As linhas imitam o que o PDV grava: vendas.total BRUTO, desconto em
// valor_desconto_manual (dividido por item e por parcela), troca em valor_troca,
// pagamento duplo com V em valor_segunda_forma + linha auxiliar marcada.
import { assert, assertAlmostEquals, assertEquals } from "jsr:@std/assert@1";
import {
  agruparVendasPorFormaPagamento,
  descontoDaVenda,
  valorLiquidoVenda,
  type BreakdownFormaPagamento,
  type VendaFormaPagamento,
} from "../../src/lib/formaPagamento.ts";
import { agruparVendasPorFormaPagamento as agruparOrigemMain } from "./referencia/formaPagamentoOrigemMain.ts";

const SECUNDARIO = "pagamento_duplo_secundario";

/** chave → total (e confere que nenhum total é negativo ou NaN). */
function totais(vendas: VendaFormaPagamento[]): Record<string, number> {
  const r: Record<string, number> = {};
  for (const item of agruparVendasPorFormaPagamento(vendas)) {
    assert(Number.isFinite(item.total), `total não finito em ${item.chave}: ${item.total}`);
    assert(item.total >= 0, `total negativo em ${item.chave}: ${item.total}`);
    r[item.chave] = item.total;
  }
  return r;
}

const v = (p: Partial<VendaFormaPagamento> & { total: number }): VendaFormaPagamento => ({ forma_pagamento: "dinheiro", ...p });

// ── Casos ────────────────────────────────────────────────────────────────────

Deno.test("sem desconto: igual a antes", () => {
  assertEquals(totais([v({ total: 100 })]), { dinheiro: 100 });
  assertEquals(totais([v({ total: 100, valor_desconto_manual: 0 })]), { dinheiro: 100 });
  assertEquals(totais([v({ total: 100, valor_desconto_manual: null, valor_desconto_cupom: null })]), { dinheiro: 100 });
});

Deno.test("desconto em valor: sai da forma da venda", () => {
  assertEquals(totais([v({ total: 100, valor_desconto_manual: 10 })]), { dinheiro: 90 });
  assertEquals(totais([v({ forma_pagamento: "pix", total: 250, valor_desconto_manual: 25.5 })]), { pix: 224.5 });
});

Deno.test("desconto manual + cupom somam", () => {
  assertEquals(totais([v({ total: 100, valor_desconto_manual: 5, valor_desconto_cupom: 7 })]), { dinheiro: 88 });
});

Deno.test("percentual (o PDV já gravou em R$, dividido igual entre os itens)", () => {
  // 2 itens: 100 + 50 = 150; 10% = 15 → 7,5 por item.
  const linhas = [
    v({ forma_pagamento: "credito", total: 100, valor_desconto_manual: 7.5 }),
    v({ forma_pagamento: "credito", total: 50, valor_desconto_manual: 7.5 }),
  ];
  const r = agruparVendasPorFormaPagamento(linhas);
  assertEquals(r.length, 1);
  assertEquals(r[0].chave, "credito");
  assertEquals(r[0].total, 135);
  assertEquals(r[0].quantidade, 2);
});

Deno.test("a receber parcelado 3x: desconto por parcela soma de volta o líquido", () => {
  const bruto = 100;
  const desconto = 10;
  const linhas = [1, 2, 3].map(() => v({ forma_pagamento: "a_receber", total: bruto / 3, valor_desconto_manual: desconto / 3 }));
  const r = agruparVendasPorFormaPagamento(linhas);
  assertEquals(r.length, 1);
  assertEquals(r[0].quantidade, 3);
  assertAlmostEquals(r[0].total, bruto - desconto, 1e-9);
});

Deno.test("troca: desconto e troca abatem a 1ª forma", () => {
  assertEquals(totais([v({ total: 1000, valor_desconto_manual: 50, valor_troca: 600 })]), { dinheiro: 350 });
});

Deno.test("troca que cobre tudo: a forma 'Troca' fica em zero (antes sobrava o desconto)", () => {
  // Plano da troca: bruto − desconto − troca = 0 em cada linha.
  const linhas = [
    v({ forma_pagamento: "outro", observacoes: "Celular A [forma:Troca]", total: 500, valor_desconto_manual: 20, valor_troca: 480 }),
    v({ forma_pagamento: "outro", observacoes: "Capa [forma:Troca]", total: 30, valor_desconto_manual: 1.2, valor_troca: 28.8 }),
  ];
  const r = totais(linhas);
  assertEquals(Object.keys(r), ["custom:Troca"]);
  assertAlmostEquals(r["custom:Troca"], 0, 1e-9);
  // Referência da origin/main: o desconto ficava somado na forma Troca.
  const antes = agruparOrigemMain(linhas);
  assertAlmostEquals(antes[0].total, 21.2, 1e-9);
});

Deno.test("pagamento duplo: desconto sai da 1ª forma, 2ª forma intacta", () => {
  const principal = v({ total: 100, valor_desconto_manual: 10, segunda_forma_pagamento: "pix", valor_segunda_forma: 40 });
  assertEquals(totais([principal]), { dinheiro: 50, pix: 40 });
});

Deno.test("pagamento duplo com troca e desconto", () => {
  const principal = v({ forma_pagamento: "debito", total: 1000, valor_desconto_manual: 100, valor_troca: 500, segunda_forma_pagamento: "dinheiro", valor_segunda_forma: 200 });
  assertEquals(totais([principal]), { debito: 200, dinheiro: 200 });
});

Deno.test("linha auxiliar pagamento_duplo_secundario continua ignorada", () => {
  const linhas = [
    v({ total: 100, valor_desconto_manual: 10, segunda_forma_pagamento: "pix", valor_segunda_forma: 40 }),
    // Auxiliar como o PDV grava: item × (V ÷ líquido), sem desconto.
    v({ forma_pagamento: "pix", total: 100 * (40 / 90), valor_desconto_manual: 0, observacoes: SECUNDARIO }),
    // Mesmo com desconto (lixo), a auxiliar não entra.
    v({ forma_pagamento: "pix", total: 999, valor_desconto_manual: 5, observacoes: SECUNDARIO }),
  ];
  const r = agruparVendasPorFormaPagamento(linhas);
  assertEquals(r.map((i) => [i.chave, i.total, i.quantidade]), [["dinheiro", 50, 1], ["pix", 40, 1]]);
});

Deno.test("forma customizada ('outro' + [forma:Nome])", () => {
  const r = agruparVendasPorFormaPagamento([
    v({ forma_pagamento: "outro", observacoes: "Fone [forma:Fiado Loja]", total: 80, valor_desconto_manual: 5 }),
  ]);
  assertEquals(r, [{ chave: "custom:Fiado Loja", nome: "Fiado Loja", total: 75, quantidade: 1, cor: "customizada" }]);
});

Deno.test("desconto maior que o total: limita no total, nunca negativo", () => {
  assertEquals(totais([v({ total: 50, valor_desconto_manual: 80 })]), { dinheiro: 0 });
  assertEquals(totais([v({ total: 50, valor_desconto_manual: 30, valor_desconto_cupom: 30 })]), { dinheiro: 0 });
  // Duplo: 1ª forma vai a 0 e a 2ª fica como foi informada.
  assertEquals(totais([v({ total: 50, valor_desconto_manual: 80, segunda_forma_pagamento: "pix", valor_segunda_forma: 10 })]), { dinheiro: 0, pix: 10 });
});

Deno.test("valores nulos/lixo no desconto: tratado como sem desconto", () => {
  const lixos: unknown[] = [null, undefined, NaN, -10, -0, "abc", Infinity, -Infinity, {}, [], ""];
  for (const lixo of lixos) {
    const linha = { forma_pagamento: "dinheiro", total: 100, valor_desconto_manual: lixo, valor_desconto_cupom: lixo } as unknown as VendaFormaPagamento;
    assertEquals(totais([linha]), { dinheiro: 100 }, `lixo: ${String(lixo)}`);
  }
  // Desconto em texto numérico (como pode vir de numeric) vale.
  const texto = { forma_pagamento: "dinheiro", total: 100, valor_desconto_manual: "10" } as unknown as VendaFormaPagamento;
  assertEquals(totais([texto]), { dinheiro: 90 });
});

Deno.test("total nulo/lixo com desconto: sem NaN e a mesma conta da origin/main", () => {
  for (const total of [null, undefined, NaN, "abc", -20]) {
    const linha = { forma_pagamento: "dinheiro", total, valor_desconto_manual: 10 } as unknown as VendaFormaPagamento;
    const r = agruparVendasPorFormaPagamento([linha]);
    const ref = agruparOrigemMain([linha]);
    assert(!Number.isNaN(r[0].total), `total ${String(total)} gerou NaN`);
    // Total inválido: desconto limitado a 0 → mesma conta da origin/main.
    assert(Object.is(r[0].total, ref[0].total), `total ${String(total)}: ${r[0].total} x ${ref[0].total}`);
  }
});

// ── descontoDaVenda / valorLiquidoVenda ─────────────────────────────────────

Deno.test("descontoDaVenda: soma, limita entre 0 e o total", () => {
  assertEquals(descontoDaVenda({ total: 100 }), 0);
  assertEquals(descontoDaVenda({ total: 100, valor_desconto_manual: 10, valor_desconto_cupom: 5 }), 15);
  assertEquals(descontoDaVenda({ total: 100, valor_desconto_manual: 150 }), 100);
  assertEquals(descontoDaVenda({ total: 100, valor_desconto_manual: -5 }), 0);
  assertEquals(descontoDaVenda({ total: 100, valor_desconto_manual: -5, valor_desconto_cupom: 3 }), 3);
  assertEquals(descontoDaVenda({ total: null, valor_desconto_manual: 10 }), 0);
  assertEquals(descontoDaVenda({ total: -50, valor_desconto_manual: 10 }), 0);
});

Deno.test("valorLiquidoVenda: total − desconto, nunca negativo", () => {
  assertEquals(valorLiquidoVenda({ total: 100 }), 100);
  assertEquals(valorLiquidoVenda({ total: 100, valor_desconto_manual: 10 }), 90);
  assertEquals(valorLiquidoVenda({ total: "100", valor_desconto_manual: "10", valor_desconto_cupom: "5" }), 85);
  assertEquals(valorLiquidoVenda({ total: 100, valor_desconto_manual: 500 }), 0);
  assertEquals(valorLiquidoVenda({ total: null }), 0);
  assertEquals(valorLiquidoVenda({ total: undefined, valor_desconto_manual: 10 }), 0);
  assertEquals(valorLiquidoVenda({ total: NaN }), 0);
  assertEquals(valorLiquidoVenda({ total: -30 }), 0);
  // Sem desconto devolve o próprio total, bit a bit (inclusive frações).
  const fracao = 100 / 3;
  assert(Object.is(valorLiquidoVenda({ total: fracao }), fracao));
  assert(Object.is(valorLiquidoVenda({ total: fracao, valor_desconto_manual: 0 }), fracao));
});

// ── Propriedade: sem desconto = origin/main, bit a bit ───────────────────────

/** PRNG determinístico (mulberry32) para o teste ser reproduzível. */
function prng(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function iguaisBitABit(a: BreakdownFormaPagamento[], b: BreakdownFormaPagamento[], ctx: string) {
  assertEquals(a.length, b.length, `${ctx}: quantidade de formas`);
  for (let i = 0; i < a.length; i++) {
    assertEquals([a[i].chave, a[i].nome, a[i].quantidade, a[i].cor], [b[i].chave, b[i].nome, b[i].quantidade, b[i].cor], `${ctx}: item ${i}`);
    assert(Object.is(a[i].total, b[i].total), `${ctx}: total de ${a[i].chave} ${a[i].total} x ${b[i].total}`);
  }
}

Deno.test("propriedade: vendas sem desconto (0, nulo, ausente, negativo, lixo) = origin/main bit a bit", () => {
  const rnd = prng(20261116);
  const escolha = <T>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)];
  const formas = ["dinheiro", "pix", "debito", "credito", "credito_parcelado", "a_receber", "a_prazo", "outro", null];
  const semDesconto: unknown[] = ["ausente", null, undefined, 0, -0, "0", -3, NaN, "x"];
  const valor = (): unknown => {
    const r = rnd();
    if (r < 0.03) return null;
    if (r < 0.05) return NaN;
    if (r < 0.06) return "12.34";
    if (r < 0.25) return Math.round(rnd() * 500000) / 100 / escolha([1, 3, 7, 12]);
    return Math.round(rnd() * 500000) / 100;
  };
  let comparacoes = 0;
  for (let caso = 0; caso < 3000; caso++) {
    const n = 1 + Math.floor(rnd() * 12);
    const vendas: Record<string, unknown>[] = [];
    for (let i = 0; i < n; i++) {
      const forma = escolha(formas);
      const linha: Record<string, unknown> = { forma_pagamento: forma, total: valor() };
      const obs = rnd();
      if (obs < 0.1) linha.observacoes = SECUNDARIO;
      else if (obs < 0.25) linha.observacoes = `Item [forma:${escolha(["Troca", "Fiado", "Vale"])}]`;
      else if (obs < 0.35) linha.observacoes = null;
      else if (obs < 0.5) linha.observacoes = "Produto teste";
      if (rnd() < 0.3) linha.valor_troca = escolha([null, 0, valor()]);
      if (rnd() < 0.3) {
        linha.segunda_forma_pagamento = escolha(["pix", "dinheiro", "a_receber", "credito", null, ""]);
        linha.valor_segunda_forma = escolha([null, 0, -5, valor()]);
      }
      for (const campo of ["valor_desconto_manual", "valor_desconto_cupom"]) {
        const d = escolha(semDesconto);
        if (d !== "ausente") linha[campo] = d;
      }
      vendas.push(linha);
    }
    const lista = vendas as unknown as VendaFormaPagamento[];
    iguaisBitABit(agruparVendasPorFormaPagamento(lista), agruparOrigemMain(lista), `caso ${caso}`);
    comparacoes++;
  }
  assertEquals(comparacoes, 3000);
});

Deno.test("propriedade: com desconto, soma das formas = soma de antes − descontos aplicados (simples, sem troca/duplo)", () => {
  const rnd = prng(42);
  for (let caso = 0; caso < 1000; caso++) {
    const n = 1 + Math.floor(rnd() * 8);
    const vendas: VendaFormaPagamento[] = [];
    let descontoEsperado = 0;
    for (let i = 0; i < n; i++) {
      const total = Math.round(rnd() * 100000) / 100;
      const desc = Math.round(rnd() * 20000) / 100;
      vendas.push({ forma_pagamento: rnd() < 0.5 ? "dinheiro" : "pix", total, valor_desconto_manual: desc });
      descontoEsperado += Math.min(desc, total);
    }
    const soma = (r: BreakdownFormaPagamento[]) => r.reduce((a, i) => a + i.total, 0);
    assertAlmostEquals(soma(agruparOrigemMain(vendas)) - soma(agruparVendasPorFormaPagamento(vendas)), descontoEsperado, 1e-6);
  }
});
