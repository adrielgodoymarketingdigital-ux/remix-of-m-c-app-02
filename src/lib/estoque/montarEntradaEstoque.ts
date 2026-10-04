/**
 * Entrada de estoque (tela "Repor Estoque") → parâmetros da RPC
 * public.registrar_entrada_estoque, mais a prévia, a mensagem de sucesso e a
 * tradução dos erros da RPC. Tudo puro: testável sem tela
 * (scripts/testes-compra-estoque/).
 *
 * Regras (as mesmas que a RPC valida no banco — aqui o usuário vê o erro antes):
 * - quantidade inteira > 0;
 * - custo opcional; se informado, >= 0;
 * - atualizar o custo pela média só com custo informado;
 * - lançar em Contas a Pagar só com custo > 0;
 * - "já paguei" só quando lança em Contas a Pagar.
 *
 * Arquivo sem imports "@/": roda direto no Deno.
 */
import { calcularCustoMedio } from "./custoMedio.ts";

export type TipoItemEstoque = "produto" | "peca";

export interface CamposEntradaEstoque {
  tipo: TipoItemEstoque;
  itemId: string;
  /** Aceita texto do input ("9") ou número. */
  quantidade: number | string;
  /** Vazio, null ou undefined = sem custo. Aceita "12,50". */
  custoUnitario?: number | string | null;
  fornecedorId?: string | null;
  atualizarCustoMedio?: boolean;
  gerarConta?: boolean;
  pago?: boolean;
  formaPagamento?: string | null;
  observacao?: string | null;
}

export interface ParametrosRpcEntradaEstoque {
  p_item_tipo: TipoItemEstoque;
  p_item_id: string;
  p_quantidade: number;
  p_custo_unitario: number | null;
  p_fornecedor_id: string | null;
  p_gerar_conta: boolean;
  p_pago: boolean;
  p_forma_pagamento: string | null;
  p_observacao: string | null;
  p_atualizar_custo_medio: boolean;
}

// Sem união discriminada: o app roda sem strictNullChecks e o `if (!r.ok)` não estreitaria.
export type ResultadoMontagem = { ok: boolean; erro?: string; params?: ParametrosRpcEntradaEstoque };

export const MAX_OBSERVACAO = 500;

/** "12,50" / "12.50" / 12.5 → 12.5; vazio → null; texto inválido → NaN. */
export function lerNumero(valor: number | string | null | undefined): number | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "number") return valor;
  const texto = valor.trim();
  if (!texto) return null;
  return Number(texto.replace(/\s/g, "").replace(",", "."));
}

const textoOuNull = (v: string | null | undefined) => {
  const t = (v ?? "").trim();
  return t ? t : null;
};

export function montarEntradaEstoque(campos: CamposEntradaEstoque): ResultadoMontagem {
  const quantidade = lerNumero(campos.quantidade);
  if (quantidade === null || !Number.isInteger(quantidade) || quantidade <= 0) {
    return { ok: false, erro: "Informe uma quantidade inteira maior que zero." };
  }

  const custo = lerNumero(campos.custoUnitario);
  if (custo !== null && !Number.isFinite(custo)) {
    return { ok: false, erro: "Custo unitário inválido." };
  }
  if (custo !== null && custo < 0) {
    return { ok: false, erro: "O custo unitário não pode ser negativo." };
  }

  const atualizarCustoMedio = campos.atualizarCustoMedio === true;
  const gerarConta = campos.gerarConta === true;
  const pago = campos.pago === true;

  if (atualizarCustoMedio && custo === null) {
    return { ok: false, erro: "Para atualizar o custo pela média, informe o custo unitário." };
  }
  if (gerarConta && !(custo !== null && custo > 0)) {
    return { ok: false, erro: "Para lançar em Contas a Pagar, informe um custo unitário maior que zero." };
  }
  if (pago && !gerarConta) {
    return { ok: false, erro: "\"Já paguei\" só vale quando a compra é lançada em Contas a Pagar." };
  }

  const observacao = textoOuNull(campos.observacao);
  if (observacao && observacao.length > MAX_OBSERVACAO) {
    return { ok: false, erro: `A observação deve ter no máximo ${MAX_OBSERVACAO} caracteres.` };
  }

  const fornecedor = textoOuNull(campos.fornecedorId);

  return {
    ok: true,
    params: {
      p_item_tipo: campos.tipo,
      p_item_id: campos.itemId,
      p_quantidade: quantidade,
      p_custo_unitario: custo,
      p_fornecedor_id: fornecedor && fornecedor !== "nenhum" ? fornecedor : null,
      p_gerar_conta: gerarConta,
      p_pago: pago,
      p_forma_pagamento: pago ? textoOuNull(campos.formaPagamento) : null,
      p_observacao: observacao,
      p_atualizar_custo_medio: atualizarCustoMedio,
    },
  };
}

// ---------------------------------------------------------------------------
// Prévia (mesma conta da RPC: custo novo arredondado a centavos; total =
// quantidade × custo; custo médio via custoMedio.ts)
// ---------------------------------------------------------------------------
export interface PreviaEntrada {
  quantidadeFinal: number;
  /** null quando não há custo informado. */
  totalCompra: number | null;
  custoAtual: number;
  /** Custo do item depois da entrada (igual ao atual se não atualizar pela média). */
  custoNovo: number;
}

export function calcularPreviaEntrada(args: {
  quantidadeAtual: number;
  custoAtual: number | null | undefined;
  quantidade: number;
  custoUnitario: number | null;
  atualizarCustoMedio: boolean;
}): PreviaEntrada {
  const custoAtual = Number(args.custoAtual || 0);
  const temCusto = args.custoUnitario !== null && Number.isFinite(args.custoUnitario) && args.custoUnitario >= 0;
  const centavos = temCusto ? Math.round((args.custoUnitario as number) * 100) : 0;
  return {
    quantidadeFinal: args.quantidadeAtual + args.quantidade,
    totalCompra: temCusto ? (centavos * args.quantidade) / 100 : null,
    custoAtual,
    custoNovo: temCusto && args.atualizarCustoMedio
      ? calcularCustoMedio(args.quantidadeAtual, args.custoAtual, args.quantidade, args.custoUnitario as number)
      : custoAtual,
  };
}

// ---------------------------------------------------------------------------
// Mensagens
// ---------------------------------------------------------------------------
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const formatarReais = (v: number) => brl.format(v);

export function mensagemSucessoEntrada(args: {
  quantidade: number;
  quantidadeFinal: number;
  atualizouCusto: boolean;
  custoAnterior: number | null | undefined;
  custoFinal: number | null | undefined;
  contaGerada: boolean;
  valorConta: number | null;
  pago: boolean;
}): string {
  const partes = [`Entrada registrada: ${args.quantidade} un. (estoque: ${args.quantidadeFinal})`];
  if (args.atualizouCusto) {
    const antes = Number(args.custoAnterior || 0);
    const depois = Number(args.custoFinal || 0);
    partes.push(
      antes === depois
        ? `custo mantido em ${formatarReais(depois)}`
        : `custo atualizado de ${formatarReais(antes)} para ${formatarReais(depois)}`
    );
  }
  if (args.contaGerada && args.valorConta !== null) {
    partes.push(`conta de ${formatarReais(args.valorConta)} lançada${args.pago ? " (paga)" : " (a pagar)"}`);
  }
  return partes.join(" | ");
}

/** Erro da RPC (PostgrestError ou similar) → mensagem em português para o usuário. */
export function traduzirErroEntradaEstoque(erro: { code?: string; message?: string } | null | undefined): string {
  const code = erro?.code ?? "";
  const msg = erro?.message ?? "";
  // Função ainda não existe no banco (migration não aplicada) ou cache do PostgREST desatualizado.
  if (code === "PGRST202" || /could not find the function/i.test(msg)) {
    return "A reposição com custo ainda não está disponível no banco. Avise o suporte.";
  }
  // A RPC usa 42501 também para "não autenticado": checar a mensagem antes do código.
  if (/não autenticado/i.test(msg)) return "Sua sessão expirou. Entre novamente.";
  if (code === "42501" || /sem acesso|permission denied|row-level security/i.test(msg)) {
    return "Você não tem acesso a este item, ou ele foi excluído.";
  }
  if (/quantidade/i.test(msg)) return "Informe uma quantidade inteira maior que zero.";
  if (/negativo/i.test(msg)) return "O custo unitário não pode ser negativo.";
  if (/contas a pagar/i.test(msg)) return "Para lançar em Contas a Pagar, informe um custo unitário maior que zero.";
  // Validação da RPC (22023) já vem em português.
  if (code === "22023" && msg) return msg;
  return "Não foi possível registrar a entrada de estoque. Tente novamente.";
}
