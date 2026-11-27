// Botão "Fazer upgrade para o Profissional" da tela de bloqueio do Marketing
// (ComVerificacaoPlano). Regra pura (sem imports; testada com Deno em
// scripts/testes-marketing-plano/).
//
// /plano?highlight=<chave> destaca o cartão com id "plan-<chave>" (Plano.tsx,
// GradePlanosDesktop). Período do plano atual: anual se o plano é *_anual;
// mensal no resto (mensal, trial, free, demonstração, sem assinatura).

export type ChaveUpgradeProfissional = "profissional_mensal" | "profissional_anual";

export function chaveUpgradeProfissional(planoAtual: string | null | undefined): ChaveUpgradeProfissional {
  return typeof planoAtual === "string" && planoAtual.endsWith("_anual") ? "profissional_anual" : "profissional_mensal";
}

export function destinoUpgradeProfissional(planoAtual: string | null | undefined): string {
  return `/plano?highlight=${chaveUpgradeProfissional(planoAtual)}`;
}

/** Período em que a tela /plano abre com ?highlight= (o cartão destacado tem de estar na tela). */
export function periodoDoHighlight(highlight: string | null | undefined): "mensal" | "anual" {
  return typeof highlight === "string" && highlight.endsWith("_anual") ? "anual" : "mensal";
}
