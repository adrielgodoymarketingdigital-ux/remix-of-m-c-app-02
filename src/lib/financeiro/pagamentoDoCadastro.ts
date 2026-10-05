/**
 * Núcleo puro (sem Supabase nem alias "@/") da decisão "que pagamento registrar
 * ao cadastrar uma conta". Usado por criarConta (useContas.ts) e testado em
 * scripts/testes-conta-paga/.
 *
 * Contas do modelo novo (usa_historico_pagamentos = true) têm pagamentos_contas
 * como fonte de verdade: o gatilho trg_pagamentos_contas_sync é quem preenche
 * status, valor_pago e data_pagamento. Uma conta inserida já como "pago" sem
 * linha de pagamento ficava sem data_pagamento (fora do Extrato) e voltava a
 * "pendente" no primeiro pagamento/estorno seguinte. Por isso a conta é
 * inserida como pendente e o pagamento é registrado logo depois.
 */
import { dataBrasiliaISO } from "../dataBrasilia.ts";

/** Campos do formulário de cadastro que importam para a decisão. */
export interface DadosCadastroConta {
  tipo: "pagar" | "receber";
  valor: number;
  status: "pendente" | "pago" | "recebido";
  valor_pago?: number | null;
  forma_pagamento?: string | null;
  forma_pagamento_entrada?: string | null;
}

/** Pagamento a gravar em pagamentos_contas (mesmos campos de registrarPagamentoParcial). */
export interface PagamentoDoCadastro {
  valor: number;
  /** YYYY-MM-DD no dia de Brasília. */
  data: string;
  forma: string | null;
  observacao: string;
}

export interface DecisaoCadastroConta {
  /** Sobrescreve os campos do formulário no insert da conta (vazio = insere como veio). */
  ajustesConta: { status?: "pendente"; valor_pago?: number; data_pagamento?: null };
  /** null = conta realmente pendente: nenhum pagamento a registrar. */
  pagamento: PagamentoDoCadastro | null;
}

const centavos = (v: number) => Math.round(v * 100) / 100;

/**
 * Status "pago"/"recebido" no cadastro = quitada: registra o valor total.
 * Senão, uma entrada (valor_pago > 0) vira um pagamento parcial desse valor.
 * Sem nenhum dos dois, a conta segue exatamente como hoje (sem pagamento).
 */
export function pagamentoDoCadastro(dados: DadosCadastroConta, agora: Date = new Date()): DecisaoCadastroConta {
  const valorConta = centavos(Number(dados.valor) || 0);
  const entrada = centavos(Number(dados.valor_pago) || 0);
  const quitada = dados.status === "pago" || dados.status === "recebido";

  const valor = quitada ? valorConta : Math.min(entrada, valorConta);
  if (valor <= 0) return { ajustesConta: {}, pagamento: null };

  return {
    ajustesConta: { status: "pendente", valor_pago: 0, data_pagamento: null },
    pagamento: {
      valor,
      data: dataBrasiliaISO(agora),
      forma: dados.forma_pagamento_entrada || dados.forma_pagamento || null,
      observacao: quitada ? "Quitação" : "Entrada",
    },
  };
}
