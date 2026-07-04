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

export function agruparVendasPorFormaPagamento(vendas: VendaFormaPagamento[]): BreakdownFormaPagamento[] {
  const mapa: Record<string, { nome: string; total: number; quantidade: number; cor: BreakdownFormaPagamento["cor"] }> = {};

  for (const venda of vendas) {
    const formaBanco = venda.forma_pagamento ?? "outro";
    const nomeCustomizado = formaBanco === "outro" ? extrairNomeFormaCustomizada(venda.observacoes) : null;
    const chave = nomeCustomizado ? `custom:${nomeCustomizado}` : formaBanco;
    const nome = nomeCustomizado ?? NOMES_FORMA[formaBanco] ?? formaBanco;
    const cor = nomeCustomizado ? "customizada" : CORES_FORMA[formaBanco] ?? "customizada";

    if (!mapa[chave]) mapa[chave] = { nome, total: 0, quantidade: 0, cor };
    mapa[chave].total += Number(venda.total) || 0;
    mapa[chave].quantidade += 1;
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
