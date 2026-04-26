export interface VendaFinanceiraLike {
  data?: string | null;
  data_recebimento?: string | null;
  forma_pagamento?: string | null;
  recebido?: boolean | null;
  cancelada?: boolean | null;
  parcela_numero?: number | null;
  total_parcelas?: number | null;
  total?: number | string | null;
  valor_desconto_manual?: number | string | null;
  valor_desconto_cupom?: number | string | null;
  custo_unitario?: number | string | null;
  quantidade?: number | string | null;
  grupo_venda?: string | null;
}

const FORMAS_POR_COMPETENCIA = new Set(["a_receber", "a_prazo"]);

const toNumber = (value: number | string | null | undefined) => Number(value || 0);

const formatDateForQuery = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getDateKeyFromValue = (value?: string | null) => {
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const normalizedValue = value.includes("T") ? value : value.replace(" ", "T");
  const parsed = new Date(normalizedValue);
  if (!Number.isNaN(parsed.getTime())) {
    return formatDateForQuery(parsed);
  }

  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];

  return null;
};

export const isVendaPorCompetenciaRecebimento = (venda: VendaFinanceiraLike) =>
  FORMAS_POR_COMPETENCIA.has(venda.forma_pagamento || "");

export const isVendaFinanceiramentePendente = (venda: VendaFinanceiraLike) =>
  isVendaPorCompetenciaRecebimento(venda) && venda.recebido !== true;

export const isVendaParcelaSubsequente = (venda: VendaFinanceiraLike) =>
  Number(venda.parcela_numero || 0) > 1;

export const shouldIncludeVendaInFinancialTotals = (venda: VendaFinanceiraLike) => {
  if (venda.cancelada) return false;
  // Para vendas "a_receber"/"a_prazo" parceladas, cada parcela conta individualmente quando recebida
  if (isVendaPorCompetenciaRecebimento(venda)) {
    if (venda.recebido !== true) return false;
    // Permitir todas as parcelas (incluindo subsequentes) desde que recebidas
    return true;
  }
  // Para outros meios de pagamento, ignorar parcelas subsequentes (lógica original)
  if (isVendaParcelaSubsequente(venda)) return false;
  return true;
};

export const getVendaDataCompetencia = (venda: VendaFinanceiraLike) => {
  if (isVendaPorCompetenciaRecebimento(venda)) {
    if (venda.recebido !== true) return null;
    return venda.data_recebimento || venda.data || null;
  }

  return venda.data || null;
};

export const isVendaInOptionalFinancialPeriod = (
  venda: VendaFinanceiraLike,
  inicio?: Date | null,
  fim?: Date | null,
) => {
  if (!shouldIncludeVendaInFinancialTotals(venda)) return false;
  if (!inicio && !fim) return true;

  const dataCompetencia = getVendaDataCompetencia(venda);
  const dataCompetenciaKey = getDateKeyFromValue(dataCompetencia);
  if (!dataCompetenciaKey) return false;

  const inicioKey = inicio ? formatDateForQuery(inicio) : null;
  const fimKey = fim ? formatDateForQuery(fim) : null;

  if (inicioKey && dataCompetenciaKey < inicioKey) return false;
  if (fimKey && dataCompetenciaKey > fimKey) return false;

  return true;
};

export const isVendaInFinancialPeriod = (
  venda: VendaFinanceiraLike,
  inicio: Date,
  fim: Date,
) => {
  if (!shouldIncludeVendaInFinancialTotals(venda)) return false;

  const dataCompetencia = getVendaDataCompetencia(venda);
  const dataCompetenciaKey = getDateKeyFromValue(dataCompetencia);
  if (!dataCompetenciaKey) return false;

  const inicioKey = formatDateForQuery(inicio);
  const fimKey = formatDateForQuery(fim);
  return dataCompetenciaKey >= inicioKey && dataCompetenciaKey <= fimKey;
};

export const getFinancialQueryDateBounds = (inicio?: Date | null, fim?: Date | null) => {
  const queryInicio = inicio ? new Date(inicio) : null;
  const queryFim = fim ? new Date(fim) : null;

  if (queryInicio) queryInicio.setDate(queryInicio.getDate() - 1);
  if (queryFim) queryFim.setDate(queryFim.getDate() + 1);

  return {
    queryInicio: queryInicio ? formatDateForQuery(queryInicio) : null,
    queryFim: queryFim ? formatDateForQuery(queryFim) : null,
  };
};

export const getVendaReceitaLiquida = (venda: VendaFinanceiraLike) => {
  const receitaBase =
    toNumber(venda.total) -
    toNumber(venda.valor_desconto_manual) -
    toNumber(venda.valor_desconto_cupom);

  // Para vendas "a_receber"/"a_prazo", cada parcela tem seu próprio valor - não multiplicar
  if (isVendaPorCompetenciaRecebimento(venda)) {
    return receitaBase;
  }

  // Para outros meios de pagamento parcelados, reconstituir valor total na parcela 1
  if (
    toNumber(venda.total_parcelas) > 1 &&
    Number(venda.parcela_numero || 1) === 1
  ) {
    return receitaBase * toNumber(venda.total_parcelas);
  }

  return receitaBase;
};

export const getVendaCustoTotal = (venda: VendaFinanceiraLike) => {
  const custoTotal = toNumber(venda.custo_unitario) * toNumber(venda.quantidade || 1);
  return custoTotal;
};

/**
 * Para vendas parceladas "a_receber"/"a_prazo", distribui o custo da parcela 1
 * igualmente entre todas as parcelas do grupo.
 * Deve ser chamado ANTES de calcular totais quando se tem acesso a todas as vendas.
 */
export const distribuirCustoParcelasGrupo = (vendas: VendaFinanceiraLike[]): VendaFinanceiraLike[] => {
  // Agrupar por grupo_venda
  const grupos = new Map<string, VendaFinanceiraLike[]>();
  const semGrupo: VendaFinanceiraLike[] = [];

  for (const v of vendas) {
    if (v.grupo_venda && isVendaPorCompetenciaRecebimento(v)) {
      const arr = grupos.get(v.grupo_venda);
      if (arr) arr.push(v);
      else grupos.set(v.grupo_venda, [v]);
    } else {
      semGrupo.push(v);
    }
  }

  const resultado: VendaFinanceiraLike[] = [...semGrupo];

  for (const [, parcelas] of grupos) {
    // Encontrar custo total do grupo (normalmente na parcela 1)
    const custoGrupo = parcelas.reduce((acc, p) => acc + toNumber(p.custo_unitario) * toNumber(p.quantidade || 1), 0);
    const totalParcelas = parcelas.length || 1;
    const custoPorParcela = custoGrupo / totalParcelas;

    for (const p of parcelas) {
      resultado.push({
        ...p,
        custo_unitario: custoPorParcela,
      });
    }
  }

  return resultado;
};