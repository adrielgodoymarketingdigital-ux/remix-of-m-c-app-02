import type { Conta } from "@/types/conta";
import { inicioDoDiaHoje, isContaVencida } from "./contaVencida.ts";

type ContaValores = Pick<Conta, "valor" | "valor_pago" | "usa_historico_pagamentos">;

/**
 * Total e saldo dependem do modelo: conta antiga guarda o saldo em `valor`
 * (com a entrada em `valor_pago`); conta nova guarda o total em `valor`.
 * (Extraído do TabelaContas sem mudar a regra.)
 */
export function calcTotalFalta(conta: ContaValores) {
  const pago = Number(conta.valor_pago || 0);
  if (conta.usa_historico_pagamentos) {
    return { total: Number(conta.valor), falta: Math.max(Number(conta.valor) - pago, 0) };
  }
  return { total: Number(conta.valor) + pago, falta: Number(conta.valor) };
}

export interface ResumoFicha {
  /** Soma do total de todas as contas. */
  total: number;
  /** Parte já paga: contas quitadas inteiras + entradas/parciais das pendentes. */
  pago: number;
  /** O que falta pagar nas contas pendentes. */
  emAberto: number;
  /** Parte do "em aberto" que já venceu (mesma regra do filtro "Vencidas"). */
  vencido: number;
  quantidade: number;
  quantidadeVencidas: number;
}

/** Resumo da ficha do fornecedor (Total = Pago + Em aberto). */
export function resumoFicha(
  contas: Array<ContaValores & Pick<Conta, "data" | "status">>,
  hoje: Date = inicioDoDiaHoje(),
): ResumoFicha {
  const r: ResumoFicha = { total: 0, pago: 0, emAberto: 0, vencido: 0, quantidade: contas.length, quantidadeVencidas: 0 };
  for (const conta of contas) {
    const { total, falta } = calcTotalFalta(conta);
    const aberto = conta.status === "pendente" ? falta : 0;
    r.total += total;
    r.emAberto += aberto;
    r.pago += total - aberto;
    if (isContaVencida(conta, hoje)) {
      r.vencido += aberto;
      r.quantidadeVencidas += 1;
    }
  }
  // Evita resíduos de ponto flutuante (ex.: 0.30000000000000004)
  const arred = (v: number) => Math.round(v * 100) / 100;
  return { ...r, total: arred(r.total), pago: arred(r.pago), emAberto: arred(r.emAberto), vencido: arred(r.vencido) };
}
