/**
 * Painel Marketing — cálculos puros do card "Cadastros e conversão por origem".
 *
 * Sem imports de alias (@/) para rodar também no deno test
 * (scripts/testes-marketing-origens). A RPC admin_mkt_origens devolve uma
 * linha por combinação fonte/meio/campanha/conteúdo; aqui ela é reagrupada
 * pela dimensão escolhida na tela.
 */

export type AgrupamentoOrigem = "fonte" | "campanha" | "conteudo";

export const AGRUPAMENTOS_ORIGEM: { valor: AgrupamentoOrigem; rotulo: string }[] = [
  { valor: "fonte", rotulo: "Fonte" },
  { valor: "campanha", rotulo: "Campanha" },
  { valor: "conteudo", rotulo: "Conteúdo/anúncio" },
];

/** Limite de linhas da RPC: se vier isso, a lista pode estar cortada. */
export const LIMITE_LINHAS_ORIGENS = 500;

/** Linha devolvida pela RPC admin_mkt_origens (bigint pode vir como string). */
export interface LinhaOrigem {
  fonte: string;
  meio: string;
  campanha: string;
  conteudo: string;
  cadastros: number | string;
  testes_iniciados: number | string;
  pagantes: number | string;
  receita_pix_centavos: number | string;
  receita_cartao_estimada_centavos: number | string;
  receita_centavos: number | string;
}

export interface TotaisOrigem {
  cadastros: number;
  testes: number;
  pagantes: number;
  receitaPixCentavos: number;
  receitaCartaoEstimadaCentavos: number;
  receitaCentavos: number;
}

export interface GrupoOrigem extends TotaisOrigem {
  chave: string;
}

function totaisDaLinha(l: LinhaOrigem): TotaisOrigem {
  return {
    cadastros: Number(l.cadastros),
    testes: Number(l.testes_iniciados),
    pagantes: Number(l.pagantes),
    receitaPixCentavos: Number(l.receita_pix_centavos),
    receitaCartaoEstimadaCentavos: Number(l.receita_cartao_estimada_centavos),
    receitaCentavos: Number(l.receita_centavos),
  };
}

function somar(a: TotaisOrigem, b: TotaisOrigem): TotaisOrigem {
  return {
    cadastros: a.cadastros + b.cadastros,
    testes: a.testes + b.testes,
    pagantes: a.pagantes + b.pagantes,
    receitaPixCentavos: a.receitaPixCentavos + b.receitaPixCentavos,
    receitaCartaoEstimadaCentavos: a.receitaCartaoEstimadaCentavos + b.receitaCartaoEstimadaCentavos,
    receitaCentavos: a.receitaCentavos + b.receitaCentavos,
  };
}

const ZERO: TotaisOrigem = {
  cadastros: 0, testes: 0, pagantes: 0, receitaPixCentavos: 0, receitaCartaoEstimadaCentavos: 0, receitaCentavos: 0,
};

/** Soma as linhas pela dimensão escolhida; ordena por cadastros (desc) e depois pelo nome. */
export function agruparOrigens(linhas: LinhaOrigem[], agrupamento: AgrupamentoOrigem): GrupoOrigem[] {
  const grupos = new Map<string, TotaisOrigem>();
  for (const l of linhas) {
    const chave = l[agrupamento];
    grupos.set(chave, somar(grupos.get(chave) ?? ZERO, totaisDaLinha(l)));
  }
  return [...grupos.entries()]
    .map(([chave, t]) => ({ chave, ...t }))
    .sort((a, b) => b.cadastros - a.cadastros || a.chave.localeCompare(b.chave, "pt-BR"));
}

export function totalOrigens(linhas: LinhaOrigem[]): TotaisOrigem {
  return linhas.reduce((t, l) => somar(t, totaisDaLinha(l)), ZERO);
}

/** Pagantes ÷ cadastros em %; null quando não há cadastros (exibir "—"). */
export function taxaConversao(pagantes: number, cadastros: number): number | null {
  return cadastros === 0 ? null : (pagantes / cadastros) * 100;
}

export function formatarConversao(taxa: number | null): string {
  if (taxa === null) return "—";
  return `${taxa.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}
