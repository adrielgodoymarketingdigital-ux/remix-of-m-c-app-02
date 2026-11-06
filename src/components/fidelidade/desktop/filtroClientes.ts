import type { ClienteFidelidade, FidelidadeNivel } from "@/types/fidelidade";

/** Valor do seletor de nível que mostra todos os clientes. */
export const TODOS_OS_NIVEIS = "todos";

/**
 * Se o nível escolhido deixou de existir (excluído nas Configurações),
 * o filtro volta para "Todos os níveis" em vez de esconder todo mundo.
 */
export function nivelFiltroEfetivo(nivelId: string, niveis: Pick<FidelidadeNivel, "id">[]): string {
  if (nivelId === TODOS_OS_NIVEIS) return TODOS_OS_NIVEIS;
  return niveis.some(n => n.id === nivelId) ? nivelId : TODOS_OS_NIVEIS;
}

/**
 * Busca + filtro de nível do computador. A busca é a mesma do celular
 * (nome contém o texto, sem diferenciar maiúsculas); o nível compara nivel.id,
 * sem consulta nova.
 */
export function filtrarClientesFidelidade(
  clientes: ClienteFidelidade[],
  busca: string,
  nivelId: string,
): ClienteFidelidade[] {
  const termo = busca.toLowerCase();
  return clientes.filter(c =>
    c.nome.toLowerCase().includes(termo) &&
    (nivelId === TODOS_OS_NIVEIS || c.nivel?.id === nivelId)
  );
}

/** Qual estado vazio mostrar quando a lista filtrada não tem ninguém. */
export function estadoVazioFidelidade(
  totalClientes: number,
  busca: string,
  nivelId: string,
): "sem-resultado" | "sem-clientes" {
  const filtroAtivo = busca.length > 0 || nivelId !== TODOS_OS_NIVEIS;
  return totalClientes > 0 && filtroAtivo ? "sem-resultado" : "sem-clientes";
}
