// deno test --no-check --allow-read=src --config scripts/testes-caixa-desconto/deno.json scripts/testes-caixa-desconto/
// Fase 2: soma das vendas no caixa (fechamento real e prévia usam a mesma
// função e as mesmas colunas) e vendido por funcionário líquido. Dados fictícios.
import { assert, assertAlmostEquals, assertEquals } from "jsr:@std/assert@1";
import {
  agregarVendasPorFuncionario,
  COLUNAS_VENDAS_CAIXA,
  SEM_FUNCIONARIO,
  somarVendasNoCaixa,
} from "../../src/lib/caixa/vendasDoCaixa.ts";
import type { VendaFormaPagamento } from "../../src/lib/formaPagamento.ts";
import { agruparVendasPorFormaPagamento as agruparOrigemMain } from "./referencia/formaPagamentoOrigemMain.ts";

const SECUNDARIO = "pagamento_duplo_secundario";
const raiz = new URL("../../", import.meta.url);
const ler = (rel: string) => Deno.readTextFileSync(new URL(rel, raiz));

// ── Referências: o código da origin/main (6c3a20b), copiado como estava ─────

/** Laço de useCaixa.ts / DialogFechamentoCaixa.tsx da origin/main (idêntico nos dois). */
function somaOrigemMain(vendas: VendaFormaPagamento[]) {
  const formasCartao = ["debito", "credito", "credito_parcelado"];
  const breakdown = agruparOrigemMain(vendas ?? []);
  let total_dinheiro = 0;
  let total_pix = 0;
  let total_cartao = 0;
  let total_a_receber = 0;
  for (const item of breakdown) {
    if (item.chave === "dinheiro") total_dinheiro += item.total;
    else if (item.chave === "pix") total_pix += item.total;
    else if (formasCartao.includes(item.chave)) total_cartao += item.total;
    else if (item.chave === "a_receber" || item.chave === "a_prazo") total_a_receber += item.total;
  }
  return { breakdown, total_dinheiro, total_pix, total_cartao, total_a_receber };
}

/** Agregado por funcionário de DialogFechamentoCaixa.tsx na origin/main. */
// deno-lint-ignore no-explicit-any
function funcionariosOrigemMain(vendas: any[]) {
  const mapaFunc: Record<string, { total: number; quantidade: number }> = {};
  for (const venda of vendas ?? []) {
    if (venda.observacoes === "pagamento_duplo_secundario") continue;
    const valor = Number(venda.total) || 0;
    const fid = venda.funcionario_id ?? "__sem_funcionario__";
    if (!mapaFunc[fid]) mapaFunc[fid] = { total: 0, quantidade: 0 };
    mapaFunc[fid].total += valor;
    mapaFunc[fid].quantidade += 1;
  }
  return mapaFunc;
}

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

/** Vendas fictícias aleatórias, SEM desconto (0, nulo, ausente). total ≥ 0 quando `soPositivo`. */
function vendasSemDesconto(rnd: () => number, soPositivo: boolean): Record<string, unknown>[] {
  const escolha = <T>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)];
  const valor = () => Math.round(rnd() * 500000) / 100 / escolha([1, 1, 1, 3, 7]);
  const n = 1 + Math.floor(rnd() * 15);
  const linhas: Record<string, unknown>[] = [];
  for (let i = 0; i < n; i++) {
    const l: Record<string, unknown> = {
      forma_pagamento: escolha(["dinheiro", "pix", "debito", "credito", "credito_parcelado", "a_receber", "a_prazo", "outro", null]),
      total: soPositivo ? valor() : escolha([valor(), null, "15.5", NaN]),
      funcionario_id: escolha([null, undefined, "f1", "f2", "f3"]),
    };
    const o = rnd();
    if (o < 0.1) l.observacoes = SECUNDARIO;
    else if (o < 0.2) l.observacoes = "Item [forma:Vale]";
    if (rnd() < 0.25) l.valor_troca = escolha([null, 0, valor()]);
    if (rnd() < 0.25) {
      l.segunda_forma_pagamento = escolha(["pix", "dinheiro", "a_receber", null]);
      l.valor_segunda_forma = escolha([null, 0, valor()]);
    }
    for (const c of ["valor_desconto_manual", "valor_desconto_cupom"]) {
      const d = escolha(["ausente", null, 0]);
      if (d !== "ausente") l[c] = d;
    }
    linhas.push(l);
  }
  return linhas;
}

// ── somarVendasNoCaixa ───────────────────────────────────────────────────────

Deno.test("somarVendasNoCaixa: sem desconto = origin/main bit a bit (3000 conjuntos)", () => {
  const rnd = prng(7);
  for (let caso = 0; caso < 3000; caso++) {
    const vendas = vendasSemDesconto(rnd, false) as unknown as VendaFormaPagamento[];
    const novo = somarVendasNoCaixa(vendas);
    const antigo = somaOrigemMain(vendas);
    for (const c of ["total_dinheiro", "total_pix", "total_cartao", "total_a_receber"] as const) {
      assert(Object.is(novo[c], antigo[c]), `caso ${caso} ${c}: ${novo[c]} x ${antigo[c]}`);
    }
    assertEquals(novo.breakdown, antigo.breakdown, `caso ${caso}: breakdown`);
  }
});

Deno.test("somarVendasNoCaixa: caixa misto com desconto (dinheiro, pix, cartão, a receber parcelado, troca, duplo)", () => {
  const vendas: VendaFormaPagamento[] = [
    { forma_pagamento: "dinheiro", total: 100, valor_desconto_manual: 10 },               // 90 dinheiro
    { forma_pagamento: "pix", total: 200, valor_desconto_manual: 0 },                     // 200 pix
    { forma_pagamento: "credito", total: 300, valor_desconto_cupom: 30 },                 // 270 cartão
    ...[1, 2, 3].map(() => ({ forma_pagamento: "a_receber", total: 150 / 3, valor_desconto_manual: 15 / 3 })), // 135 a receber
    { forma_pagamento: "dinheiro", total: 1000, valor_desconto_manual: 50, valor_troca: 600 },             // 350 dinheiro
    { forma_pagamento: "dinheiro", total: 400, valor_desconto_manual: 40, segunda_forma_pagamento: "pix", valor_segunda_forma: 160 }, // 200 dinheiro + 160 pix
    { forma_pagamento: "pix", total: 160 * (400 / 360), observacoes: SECUNDARIO },        // ignorada
  ];
  const r = somarVendasNoCaixa(vendas);
  assertEquals(r.total_dinheiro, 640);
  assertEquals(r.total_pix, 360);
  assertEquals(r.total_cartao, 270);
  assertAlmostEquals(r.total_a_receber, 135, 1e-9);
  // Antes (origin/main): o desconto todo (10+30+15+50+40 = 145) ficava somado.
  const antes = somaOrigemMain(vendas);
  const soma = (x: typeof r) => x.total_dinheiro + x.total_pix + x.total_cartao + x.total_a_receber;
  assertAlmostEquals(soma(antes) - soma(r), 145, 1e-9);
  assertEquals(antes.total_dinheiro - r.total_dinheiro, 100); // 10 + 50 + 40
});

// ── Prévia e fechamento real: mesma função e mesmas colunas ─────────────────

Deno.test("prévia e fechamento real usam somarVendasNoCaixa e COLUNAS_VENDAS_CAIXA", () => {
  const useCaixa = ler("src/hooks/useCaixa.ts");
  const previa = ler("src/components/pdv/DialogFechamentoCaixa.tsx");
  for (const [nome, src] of [["useCaixa.ts", useCaixa], ["DialogFechamentoCaixa.tsx", previa]]) {
    assert(src.includes("somarVendasNoCaixa(vendas ?? [])"), `${nome}: não chama somarVendasNoCaixa`);
    assert(/\.select\((`\$\{)?COLUNAS_VENDAS_CAIXA/.test(src), `${nome}: select de vendas sem COLUNAS_VENDAS_CAIXA`);
    // Nenhum select de vendas escrito à mão com forma_pagamento + total.
    assert(!/select\("forma_pagamento, total/.test(src), `${nome}: select antigo de vendas ainda presente`);
    // O laço próprio por forma saiu (a soma é só a função compartilhada).
    assert(!src.includes('if (item.chave === "dinheiro") total_dinheiro += item.total'), `${nome}: laço próprio por forma ainda presente`);
  }
  const secao = ler("src/components/financeiro/SecaoVendasPorFormaPagamento.tsx");
  assert(secao.includes("${COLUNAS_VENDAS_CAIXA}, grupo_venda"), "Financeiro: select sem as colunas do caixa");
});

Deno.test("COLUNAS_VENDAS_CAIXA: as de antes + as duas de desconto", () => {
  const antes = "forma_pagamento, total, observacoes, segunda_forma_pagamento, valor_segunda_forma, valor_troca".split(", ");
  const agora = COLUNAS_VENDAS_CAIXA.split(", ");
  assertEquals(agora, [...antes, "valor_desconto_manual", "valor_desconto_cupom"]);
});

// ── Vendido por funcionário ─────────────────────────────────────────────────

Deno.test("agregarVendasPorFuncionario: líquido do desconto, troca não sai, auxiliar ignorada", () => {
  const r = agregarVendasPorFuncionario([
    { funcionario_id: "f1", total: 100, valor_desconto_manual: 10 },
    { funcionario_id: "f1", total: 50, valor_desconto_cupom: 5 },
    { funcionario_id: "f2", total: 1000, valor_desconto_manual: 50 }, // troca de 600 na linha: não sai daqui
    { funcionario_id: "f2", total: 999, observacoes: SECUNDARIO },
    { funcionario_id: null, total: 30 },
    { total: 20, valor_desconto_manual: 80 }, // desconto maior que o total → 0
  ]);
  assertEquals(r, {
    f1: { total: 135, quantidade: 2 },
    f2: { total: 950, quantidade: 1 },
    [SEM_FUNCIONARIO]: { total: 30, quantidade: 2 },
  });
});

Deno.test("agregarVendasPorFuncionario: sem desconto e total ≥ 0 = origin/main bit a bit", () => {
  const rnd = prng(99);
  for (let caso = 0; caso < 2000; caso++) {
    const vendas = vendasSemDesconto(rnd, true);
    const novo = agregarVendasPorFuncionario(vendas as never);
    const antigo = funcionariosOrigemMain(vendas);
    assertEquals(Object.keys(novo), Object.keys(antigo), `caso ${caso}`);
    for (const k of Object.keys(antigo)) {
      assert(Object.is(novo[k].total, antigo[k].total), `caso ${caso} ${k}: ${novo[k].total} x ${antigo[k].total}`);
      assertEquals(novo[k].quantidade, antigo[k].quantidade);
    }
  }
});

Deno.test("agregarVendasPorFuncionario: total nulo/lixo vira 0 (como antes); negativo vira 0 (antes ficava negativo)", () => {
  const r = agregarVendasPorFuncionario([
    { funcionario_id: "f1", total: null },
    { funcionario_id: "f1", total: "abc" },
    { funcionario_id: "f2", total: -40 },
  ]);
  assertEquals(r.f1, { total: 0, quantidade: 2 });
  assertEquals(r.f2, { total: 0, quantidade: 1 });
  assertEquals(funcionariosOrigemMain([{ funcionario_id: "f2", total: -40 }]).f2.total, -40);
});
