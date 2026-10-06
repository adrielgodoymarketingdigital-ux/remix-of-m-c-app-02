/**
 * Regras puras da tela Origem de Dispositivos (compras_dispositivos): filtro de
 * empresa da lista, dados do insert e datas de calendário (data_compra é
 * `date`, "AAAA-MM-DD"). Sem dependências (testado com Deno em
 * scripts/testes-menu-compras/).
 */

/**
 * Filtro de empresa da lista, mesma regra de applyEmpresaFilter
 * (useResolvedUserId.ts): filial = só a filial; matriz = a matriz e as linhas
 * sem empresa (legadas e as gravadas antes de o insert preencher empresa_id);
 * sem empresa = sem filtro. O filtro por user_id continua no hook.
 */
export type FiltroEmpresaCompras =
  | { tipo: "nenhum" }
  | { tipo: "eq"; empresaId: string }
  | { tipo: "eq_ou_nulo"; empresaId: string; expressaoOr: string };

export function filtroEmpresaCompras(empresaId: string | null | undefined, isFilial: boolean): FiltroEmpresaCompras {
  if (!empresaId) return { tipo: "nenhum" };
  if (isFilial) return { tipo: "eq", empresaId };
  return { tipo: "eq_ou_nulo", empresaId, expressaoOr: `empresa_id.eq.${empresaId},empresa_id.is.null` };
}

/** O que o filtro acima deixa passar (espelho em memória, para teste e conferência). */
export function compraPassaNoFiltroEmpresa(empresaIdDaCompra: string | null | undefined, filtro: FiltroEmpresaCompras): boolean {
  switch (filtro.tipo) {
    case "nenhum":
      return true;
    case "eq":
      return empresaIdDaCompra === filtro.empresaId;
    case "eq_ou_nulo":
      return empresaIdDaCompra == null || empresaIdDaCompra === filtro.empresaId;
  }
}

/** Linha do insert: dados do formulário + dono, empresa ativa (null sem empresa) e datas das assinaturas. */
export function montarDadosInsercaoCompra<T extends { assinatura_vendedor?: string; assinatura_cliente?: string }>(
  dados: T,
  ctx: { userId: string; empresaId: string | null | undefined; agora: Date },
): T & { user_id: string; empresa_id: string | null; assinatura_vendedor_data?: string; assinatura_cliente_data?: string } {
  const agoraISO = ctx.agora.toISOString();
  return {
    ...dados,
    user_id: ctx.userId,
    empresa_id: ctx.empresaId ?? null,
    assinatura_vendedor_data: dados.assinatura_vendedor ? agoraISO : undefined,
    assinatura_cliente_data: dados.assinatura_cliente ? agoraISO : undefined,
  };
}

const RE_DATA = /^\d{4}-\d{2}-\d{2}/;

/** "AAAA-MM-DD" (também aceita timestamp, pega só a data) ou null. */
function dataCalendario(valor: string | null | undefined): string | null {
  const m = valor ? RE_DATA.exec(valor) : null;
  return m ? m[0] : null;
}

/**
 * Filtro de período da tela comparando datas de calendário como texto
 * ("AAAA-MM-DD" ordena igual à data) — sem Date, então sem fuso nem meia-noite UTC.
 * Limite vazio = sem limite daquele lado; ambos inclusivos.
 */
export function compraNoPeriodo(dataCompra: string, inicial: string, final: string): boolean {
  const d = dataCalendario(dataCompra);
  if (!d) return !inicial && !final;
  const ini = dataCalendario(inicial);
  const fim = dataCalendario(final);
  if (ini && d < ini) return false;
  if (fim && d > fim) return false;
  return true;
}

/** Compras de hoje e do mês atual, com `hojeISO` = dataBrasiliaISO(). */
export function contarHojeEMes(datasCompra: string[], hojeISO: string): { hoje: number; esteMes: number } {
  const mes = hojeISO.slice(0, 7);
  let hoje = 0;
  let esteMes = 0;
  for (const valor of datasCompra) {
    const d = dataCalendario(valor);
    if (!d) continue;
    if (d === hojeISO) hoje++;
    if (d.slice(0, 7) === mes) esteMes++;
  }
  return { hoje, esteMes };
}
