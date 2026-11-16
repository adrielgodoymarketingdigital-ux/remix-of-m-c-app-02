/**
 * Cenários fictícios da prévia do fechamento de caixa (só desenvolvimento).
 * As linhas imitam o que o PDV grava: vendas.total BRUTO, desconto em
 * valor_desconto_manual (dividido por item e por parcela), troca em
 * valor_troca, pagamento duplo com V em valor_segunda_forma + linha auxiliar.
 * Nenhum dado real: ids, nomes e valores inventados.
 */
import type { Caixa } from "@/types/caixa";

export const USUARIO_ID = "00000000-0000-4000-8000-0000000000aa";
export const ABERTURA = "2026-11-16T11:00:00.000Z"; // 08:00 em Brasília
export const AGORA = "2026-11-16T20:00:00.000Z"; // relógio fixo da página
const NA_JANELA = "2026-11-16T15:00:00.000Z";

export const CAIXA: Caixa = {
  id: "caixa-ficticio-1",
  user_id: USUARIO_ID,
  proprietario_id: USUARIO_ID,
  empresa_id: null,
  data_abertura: ABERTURA,
  data_fechamento: null,
  saldo_inicial: 100,
  saldo_final: null,
  total_vendas: 0,
  total_dinheiro: 0,
  total_pix: 0,
  total_cartao: 0,
  total_a_receber: 0,
  total_servicos: 0,
  total_devolucoes_troca: 0,
  observacoes: null,
  status: "aberto",
  created_at: ABERTURA,
};

type Linha = Record<string, unknown>;
let seq = 0;
const venda = (p: Linha): Linha => ({
  id: `venda-${++seq}`,
  user_id: USUARIO_ID,
  empresa_id: null,
  data: NA_JANELA,
  cancelada: null,
  funcionario_id: null,
  observacoes: "Item fictício",
  segunda_forma_pagamento: null,
  valor_segunda_forma: null,
  valor_troca: null,
  ...p,
});

/** Mesmas vendas; `comDesconto` decide se cada uma leva desconto. */
function vendasDoCenario(comDesconto: boolean): Linha[] {
  const d = (valor: number) => (comDesconto ? valor : 0);
  return [
    // Dinheiro simples (vendedor 1)
    venda({ forma_pagamento: "dinheiro", total: 100, valor_desconto_manual: d(10), funcionario_id: "func-1" }),
    // Pix com desconto percentual já convertido em R$ (2 itens, 10% de 150 = 15 → 7,5 por item)
    venda({ forma_pagamento: "pix", total: 100, valor_desconto_manual: d(7.5), funcionario_id: "func-1" }),
    venda({ forma_pagamento: "pix", total: 50, valor_desconto_manual: d(7.5), funcionario_id: "func-1" }),
    // Cartão de crédito (cupom)
    venda({ forma_pagamento: "credito", total: 300, valor_desconto_manual: 0, valor_desconto_cupom: d(30), funcionario_id: "func-2" }),
    // A receber parcelado 3x (desconto 15 dividido por parcela)
    ...[1, 2, 3].map((n) =>
      venda({ forma_pagamento: "a_receber", total: 150 / 3, valor_desconto_manual: d(15) / 3, parcela_numero: n, total_parcelas: 3, funcionario_id: "func-2" }),
    ),
    // Troca: aparelho de 1000, recebeu um de 600 na troca, resto em dinheiro
    venda({ forma_pagamento: "dinheiro", total: 1000, valor_desconto_manual: d(50), valor_troca: 600 }),
    // Pagamento duplo: 400 com desconto, 160 no pix e o resto em dinheiro
    venda({ forma_pagamento: "dinheiro", total: 400, valor_desconto_manual: d(40), segunda_forma_pagamento: "pix", valor_segunda_forma: 160, funcionario_id: "func-1" }),
    venda({ forma_pagamento: "pix", total: 400 * (160 / (400 - d(40))), valor_desconto_manual: 0, observacoes: "pagamento_duplo_secundario", funcionario_id: "func-1" }),
    // Forma customizada
    venda({ forma_pagamento: "outro", total: 80, valor_desconto_manual: d(5), observacoes: "Capa fictícia [forma:Vale presente]" }),
    // Item consumido numa OS: não entra pelas vendas
    venda({ forma_pagamento: "dinheiro", total: 45, observacoes: "Película - utilizado na OS #9001" }),
  ];
}

function tabelas(comDesconto: boolean): Record<string, Linha[]> {
  return {
    caixas: [{ ...CAIXA }],
    vendas: vendasDoCenario(comDesconto),
    vendas_avulsas: [{ id: "avulsa-1", user_id: USUARIO_ID, valor: 25, forma_pagamento: "dinheiro", deleted_at: null, created_at: NA_JANELA }],
    ordens_servico: [{
      numero_os: "9001", user_id: USUARIO_ID, empresa_id: null, total: 220, forma_pagamento: "pix", avarias: null,
      created_at: "2026-11-16T12:00:00.000Z", data_caixa: "2026-11-16", data_saida: "2026-11-16 15:30:00",
      status: "entregue", deleted_at: null, clientes: { nome: "Cliente Fictício" },
    }],
    contas: [],
    caixa_movimentacoes: [
      { caixa_id: CAIXA.id, tipo: "sangria", valor: 50 },
      { caixa_id: CAIXA.id, tipo: "suprimento", valor: 20 },
    ],
    vendas_trocas: [],
    loja_funcionarios: [
      { id: "func-1", nome: "Vendedor Fictício A" },
      { id: "func-2", nome: "Vendedor Fictício B" },
    ],
  };
}

export const CENARIOS: Record<string, Record<string, Linha[]>> = {
  "sem-desconto": tabelas(false),
  "com-desconto": tabelas(true),
};
