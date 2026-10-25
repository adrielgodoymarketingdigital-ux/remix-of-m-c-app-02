// TZ=UTC deno test --no-check scripts/testes-recibo-venda-novo/
// O recibo logo após o PDV (entradaDoPDV + extrasDoBanco) sai IGUAL ao recibo
// reaberto em Vendas (entradaDasLinhas) para a mesma venda. Dados fictícios.
import { assertEquals } from "jsr:@std/assert@1";
import {
  type DadosPDVParaRecibo,
  type DadosVendaCarregados,
  entradaDasLinhas,
  entradaDoPDV,
  extrasDoBanco,
  type LinhaVendaRecibo,
  montarReciboVenda,
} from "../../src/lib/vendas/reciboVendaModelo.ts";
import { planejarTrocaPorLinha } from "../../src/lib/vendas/trocaPDV.ts";

const DATA = "2026-10-24T21:55:00.000Z";
const LOJA = { nome_loja: "Loja Exemplo", instagram: "@lojaexemplo", telefone: "(11) 3000-0000" };
const TROCA = { aparelho: { marca: "Apple", modelo: "iPhone 13" }, valorEntrada: 2000, cancelada: false, valorDevolvido: 0, formaDevolucao: null };

let seq = 0;
const linha = (over: Partial<LinhaVendaRecibo>): LinhaVendaRecibo => ({
  id: `v${++seq}`, tipo: "dispositivo", dispositivo_id: "d1", quantidade: 1, total: 0, forma_pagamento: "pix",
  data: DATA, numero_venda: "VD-000777", imei_dispositivo: "350000000000015", tempo_garantia: 6, funcionario_id: "f1", ...over,
});

const banco = (linhas: LinhaVendaRecibo[], troca = TROCA as DadosVendaCarregados["troca"]): DadosVendaCarregados => ({
  linhas,
  cliente: { nome: "Cliente Teste", cpf: "000.000.000-00" },
  produtos: {
    d1: { marca: "Apple", modelo: "iPhone 15", cor: "Azul", capacidade_gb: 128, condicao: "semi_novo", imei: "350000000000015", imei2: "350000000000016", fotoUrl: "https://exemplo.test/d1.jpg" },
    p1: { nome: "Película", sku: "PEL-1", fotoUrl: null },
  },
  troca: troca ? { ...troca, condicao: "usado", fotoUrl: "https://exemplo.test/t.jpg" } : null,
  vendedorNome: "Vendedor Teste",
});

/** Itens como o carrinho do PDV traz (sem cor, capacidade, SKU nem foto). */
const itemIphone = { id: "d1", tipo: "dispositivo" as const, nome: "Apple iPhone 15", preco: 5000, quantidade: 1, dispositivo_id: "d1", imei_dispositivo: "350000000000015", imei2: "350000000000016", condicao: "semi_novo", tempo_garantia: 6 };

function comparar(pdv: DadosPDVParaRecibo, carregados: DadosVendaCarregados) {
  const ctx = { loja: LOJA, origemApp: "https://appmec.in" };
  const doPdv = montarReciboVenda(entradaDoPDV(pdv, { ...ctx, ...extrasDoBanco(carregados) }));
  const reaberto = montarReciboVenda(entradaDasLinhas(carregados, ctx));
  assertEquals(doPdv, reaberto);
  return doPdv;
}

Deno.test("a receber 4x com troca e desconto: PDV = reaberto (itens, foto, vendedor, parcelas)", () => {
  const troca = planejarTrocaPorLinha([{ bruto: 5000, desconto: 100 }], [4], 2000)[0];
  const datas = ["2026-11-24", "2026-12-24", "2027-01-24", "2027-02-24"];
  const linhas = [0, 1, 2, 3].map((k) => linha({ forma_pagamento: "a_receber", total: 1250, valor_desconto_manual: 25, valor_troca: troca[k], parcela_numero: k + 1, total_parcelas: 4, data_prevista_recebimento: datas[k], valor_conta_receber: 725 }));
  const r = comparar({
    itens: [itemIphone], cliente: { nome: "Cliente Teste", cpf: "000.000.000-00" }, subtotal: 5000, descontoManual: 100, descontoCupom: 0,
    total: 2900, troca: TROCA, formaPagamento: "a_receber", nomeFormaPagamento: "A Receber", data: DATA, numeroVenda: "VD-000777",
  }, banco(linhas));
  assertEquals(r.itens[0].detalhes, ["Cor: Azul | 128 GB", "Condição: Semi Novo", "IMEI: 350000000000015", "IMEI 2: 350000000000016"]);
  assertEquals(r.vendedor, "Vendedor Teste");
  assertEquals(r.pagamento.formas[0].parcelas.length, 4);
});

Deno.test("pagamento duplo PIX + a receber 2x, dois itens: PDV = reaberto", () => {
  const linhas = [
    linha({ total: 1800, segunda_forma_pagamento: "a_receber", valor_segunda_forma: 700 }),
    linha({ tipo: "produto", dispositivo_id: null, produto_id: "p1", imei_dispositivo: null, tempo_garantia: null, total: 100, segunda_forma_pagamento: "a_receber", valor_segunda_forma: 0 }),
    ...[1, 2].map((k) => linha({ total: 350, forma_pagamento: "a_receber", observacoes: "pagamento_duplo_secundario", parcela_numero: k, total_parcelas: 2, data_prevista_recebimento: `2026-1${k}-10` })),
  ];
  comparar({
    itens: [{ ...itemIphone, preco: 1800 }, { id: "p1", tipo: "produto", nome: "Película", preco: 100, quantidade: 1, produto_id: "p1" }],
    cliente: { nome: "Cliente Teste", cpf: "000.000.000-00" }, subtotal: 1900, descontoManual: 0, descontoCupom: 0, total: 1900,
    formaPagamento: "pix", nomeFormaPagamento: "PIX", data: DATA, numeroVenda: "VD-000777",
    pagamentoDuplo: { valorPrimeira: 1200, segundaForma: "a_receber", nomeSegundaForma: "A Receber", valorSegunda: 700 },
  }, banco(linhas, null));
});
