import comumPtBR from "../locales/pt-BR/comum.ts";

// Formas customizadas são salvas no banco como forma_pagamento="outro",
// com o nome real embutido em observacoes como sufixo "[forma:NomeDaForma]" (ver PDV.tsx)
const REGEX_FORMA_CUSTOMIZADA = /\[forma:(.+?)\]/;

export function extrairNomeFormaCustomizada(observacoes: string | null | undefined): string | null {
  if (!observacoes) return null;
  const match = observacoes.match(REGEX_FORMA_CUSTOMIZADA);
  return match ? match[1] : null;
}

export interface VendaFormaPagamento {
  forma_pagamento: string | null;
  observacoes?: string | null;
  total: number;
  segunda_forma_pagamento?: string | null;
  valor_segunda_forma?: number | null;
  /** Aparelho recebido na troca (pagamento em espécie): não entra em nenhuma forma. NULL = sem troca. */
  valor_troca?: number | null;
  /** Desconto manual da linha (vendas.total é BRUTO). Ausente/nulo = 0. */
  valor_desconto_manual?: number | null;
  /** Desconto de cupom da linha. Ausente/nulo = 0. */
  valor_desconto_cupom?: number | null;
}

/** Linha mínima para o valor líquido (total bruto menos descontos). */
export interface VendaComDesconto {
  total: number | string | null | undefined;
  valor_desconto_manual?: number | string | null;
  valor_desconto_cupom?: number | string | null;
}

/** Número finito e positivo; qualquer outra coisa (nulo, NaN, negativo, lixo) = 0. */
const positivoOuZero = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Desconto da linha (manual + cupom), limitado entre 0 e o total bruto da
 * linha: desconto negativo, NaN ou nulo vira 0; maior que o total vira o total.
 */
export function descontoDaVenda(venda: VendaComDesconto): number {
  const desconto = positivoOuZero(venda.valor_desconto_manual) + positivoOuZero(venda.valor_desconto_cupom);
  if (desconto <= 0) return 0;
  return Math.min(desconto, positivoOuZero(venda.total));
}

/**
 * Valor líquido da linha (total bruto − desconto), nunca negativo. Não abate
 * troca nem 2ª forma. Sem desconto e com total ≥ 0 devolve o próprio total.
 * Para o agregado por funcionário do fechamento (ainda não ligado nas telas).
 */
export function valorLiquidoVenda(venda: VendaComDesconto): number {
  const bruto = Number(venda.total) || 0;
  const desconto = descontoDaVenda(venda);
  return Math.max(0, desconto > 0 ? bruto - desconto : bruto);
}

export interface BreakdownFormaPagamento {
  chave: string;
  nome: string;
  total: number;
  quantidade: number;
  cor: "dinheiro" | "pix" | "cartao" | "a_receber" | "customizada";
}

/**
 * Nomes em pt-BR (tabela única em locales/pt-BR/comum.ts). São os que vão para
 * o banco e para o recibo; a tela traduz passando `nomes` (useNomesFormaPagamento).
 */
export const NOMES_FORMA: Readonly<Record<string, string>> = comumPtBR.formaPagamento.curto;
const NAO_INFORMADA = comumPtBR.formaPagamento.naoInformada;

/** Nome de exibição de uma forma de pagamento (resolve a forma customizada salva em observacoes). */
export function nomeFormaPagamento(
  forma: string | null | undefined,
  observacoes?: string | null,
  nomes: { curto: Readonly<Record<string, string>>; naoInformada: string } = { curto: NOMES_FORMA, naoInformada: NAO_INFORMADA },
): string {
  if (!forma) return nomes.naoInformada;
  const nomeCustomizado = forma === "outro" ? extrairNomeFormaCustomizada(observacoes) : null;
  return nomeCustomizado ?? nomes.curto[forma] ?? forma;
}

const CORES_FORMA: Record<string, BreakdownFormaPagamento["cor"]> = {
  dinheiro: "dinheiro",
  pix: "pix",
  debito: "cartao",
  credito: "cartao",
  credito_parcelado: "cartao",
  a_receber: "a_receber",
  a_prazo: "a_receber",
};

// Marcador gravado em `observacoes` do registro auxiliar de pagamento duplo (ver PDV.tsx).
// Esse registro já é uma cópia do valor da 2ª forma — precisa ser ignorado aqui, senão
// o valor da 2ª forma seria contado 2x (uma vez rateado do principal, outra vez neste registro).
const MARCADOR_PAGAMENTO_DUPLO_SECUNDARIO = "pagamento_duplo_secundario";

function adicionar(
  mapa: Record<string, { nome: string; total: number; quantidade: number; cor: BreakdownFormaPagamento["cor"] }>,
  formaBanco: string,
  observacoes: string | null | undefined,
  valor: number,
  nomes: Readonly<Record<string, string>>
) {
  const nomeCustomizado = formaBanco === "outro" ? extrairNomeFormaCustomizada(observacoes) : null;
  const chave = nomeCustomizado ? `custom:${nomeCustomizado}` : formaBanco;
  const nome = nomeCustomizado ?? nomes[formaBanco] ?? formaBanco;
  const cor = nomeCustomizado ? "customizada" : CORES_FORMA[formaBanco] ?? "customizada";

  if (!mapa[chave]) mapa[chave] = { nome, total: 0, quantidade: 0, cor };
  mapa[chave].total += valor;
  mapa[chave].quantidade += 1;
}

/** `nomes`: nomes de exibição (padrão: pt-BR; a tela passa os do idioma aplicado). */
export function agruparVendasPorFormaPagamento(
  vendas: VendaFormaPagamento[],
  nomes: Readonly<Record<string, string>> = NOMES_FORMA
): BreakdownFormaPagamento[] {
  const mapa: Record<string, { nome: string; total: number; quantidade: number; cor: BreakdownFormaPagamento["cor"] }> = {};

  for (const venda of vendas) {
    // Registro auxiliar do pagamento duplo: seu valor já é contabilizado como a
    // 2ª forma do registro principal correspondente (via valor_segunda_forma). Ignorar aqui.
    if (venda.observacoes === MARCADOR_PAGAMENTO_DUPLO_SECUNDARIO) continue;

    // Desconto e troca abatem só a 1ª forma: a 2ª forma é um valor informado à parte
    // (o que o cliente de fato pagou nela). vendas.total é BRUTO (ver PDV.tsx).
    // Sem desconto a conta é exatamente a de antes (mesmos bits): não subtrai 0.
    const bruto = Number(venda.total) || 0;
    const desconto = descontoDaVenda(venda);
    const totalVenda = (desconto > 0 ? bruto - desconto : bruto) - (Number(venda.valor_troca) || 0);
    const valorSegunda = Number(venda.valor_segunda_forma) || 0;

    if (venda.segunda_forma_pagamento && valorSegunda > 0) {
      // Pagamento duplo: rateia entre a 1ª forma (restante) e a 2ª forma
      const formaBanco = venda.forma_pagamento ?? "outro";
      adicionar(mapa, formaBanco, venda.observacoes, Math.max(0, totalVenda - valorSegunda), nomes);
      adicionar(mapa, venda.segunda_forma_pagamento, null, valorSegunda, nomes);
    } else {
      const formaBanco = venda.forma_pagamento ?? "outro";
      adicionar(mapa, formaBanco, venda.observacoes, totalVenda, nomes);
    }
  }

  return Object.entries(mapa)
    .map(([chave, dados]) => ({ chave, ...dados }))
    .sort((a, b) => b.total - a.total);
}

export const CORES_BADGE_FORMA_PAGAMENTO: Record<BreakdownFormaPagamento["cor"], string> = {
  dinheiro: "text-green-600",
  pix: "text-teal-600",
  cartao: "text-blue-600",
  a_receber: "text-amber-600",
  customizada: "text-purple-600",
};

/**
 * Dinheiro que deve estar na gaveta no fechamento (mesma conta do fechamento real e do preview).
 * devolucoesDinheiro: devoluções de troca em dinheiro feitas no caixa (saíram da gaveta).
 */
export function calcularDinheiroEsperado(p: {
  saldoInicial: number;
  totalDinheiro: number;
  suprimentos: number;
  sangrias: number;
  devolucoesDinheiro?: number;
}): number {
  const esperado = (Number(p.saldoInicial) || 0) + p.totalDinheiro + p.suprimentos - p.sangrias;
  // Sem devolução, a mesma conta de sempre (mesmos bits).
  return p.devolucoesDinheiro ? esperado - p.devolucoesDinheiro : esperado;
}
