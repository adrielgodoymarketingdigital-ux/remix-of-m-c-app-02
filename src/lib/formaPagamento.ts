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
}

export interface BreakdownFormaPagamento {
  chave: string;
  nome: string;
  total: number;
  quantidade: number;
  cor: "dinheiro" | "pix" | "cartao" | "a_receber" | "customizada";
}

const NOMES_FORMA: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  debito: "Débito",
  credito: "Crédito",
  credito_parcelado: "Crédito Parcelado",
  a_receber: "A Receber",
  a_prazo: "A Receber",
};

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
  valor: number
) {
  const nomeCustomizado = formaBanco === "outro" ? extrairNomeFormaCustomizada(observacoes) : null;
  const chave = nomeCustomizado ? `custom:${nomeCustomizado}` : formaBanco;
  const nome = nomeCustomizado ?? NOMES_FORMA[formaBanco] ?? formaBanco;
  const cor = nomeCustomizado ? "customizada" : CORES_FORMA[formaBanco] ?? "customizada";

  if (!mapa[chave]) mapa[chave] = { nome, total: 0, quantidade: 0, cor };
  mapa[chave].total += valor;
  mapa[chave].quantidade += 1;
}

export function agruparVendasPorFormaPagamento(vendas: VendaFormaPagamento[]): BreakdownFormaPagamento[] {
  const mapa: Record<string, { nome: string; total: number; quantidade: number; cor: BreakdownFormaPagamento["cor"] }> = {};

  for (const venda of vendas) {
    // Registro auxiliar do pagamento duplo: seu valor já é contabilizado como a
    // 2ª forma do registro principal correspondente (via valor_segunda_forma). Ignorar aqui.
    if (venda.observacoes === MARCADOR_PAGAMENTO_DUPLO_SECUNDARIO) continue;

    const totalVenda = Number(venda.total) || 0;
    const valorSegunda = Number(venda.valor_segunda_forma) || 0;

    if (venda.segunda_forma_pagamento && valorSegunda > 0) {
      // Pagamento duplo: rateia entre a 1ª forma (restante) e a 2ª forma
      const formaBanco = venda.forma_pagamento ?? "outro";
      adicionar(mapa, formaBanco, venda.observacoes, Math.max(0, totalVenda - valorSegunda));
      adicionar(mapa, venda.segunda_forma_pagamento, null, valorSegunda);
    } else {
      const formaBanco = venda.forma_pagamento ?? "outro";
      adicionar(mapa, formaBanco, venda.observacoes, totalVenda);
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
