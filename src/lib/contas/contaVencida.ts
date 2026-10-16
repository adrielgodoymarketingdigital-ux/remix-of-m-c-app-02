import type { Conta } from "@/types/conta";

/**
 * Regra única de "conta vencida" — usada pelo card "Contas Vencidas"
 * (DashboardContas) e pelo filtro "Vencidas" da lista (Contas.tsx), para os
 * dois sempre baterem.
 *
 * Mesma regra que o card já usava: pendente e com vencimento antes de hoje,
 * comparando datas à meia-noite do horário do aparelho.
 */
export function inicioDoDiaHoje(): Date {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0); // Zerar horas para comparar apenas data
  return hoje;
}

export function isContaVencida(conta: Pick<Conta, "data" | "status">, hoje: Date = inicioDoDiaHoje()): boolean {
  const dataVencimento = new Date(conta.data + "T00:00:00");
  return dataVencimento < hoje && conta.status === "pendente";
}
