/** Cor de destaque do cartão (fundo suave, borda e caixinha do ícone). Só visual. */
export type TomCardFinanceiro = "vermelho" | "azul" | "verde" | "roxo" | "laranja" | "neutro";

export const ESTILO_TOM: Record<TomCardFinanceiro, { card: string; caixa: string; degrade: string }> = {
  vermelho: {
    card: "border-red-200/80 bg-gradient-to-br from-card to-red-50/70 dark:border-red-900/50 dark:to-red-950/25",
    caixa: "bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400",
    degrade: "from-red-100/90 dark:from-red-950/40",
  },
  azul: {
    card: "border-primary/25 bg-gradient-to-br from-card to-primary/[0.06]",
    caixa: "bg-primary/10 text-primary",
    degrade: "from-primary/15",
  },
  verde: {
    card: "border-green-200/80 bg-gradient-to-br from-card to-green-50/70 dark:border-green-900/50 dark:to-green-950/25",
    caixa: "bg-green-100 text-green-600 dark:bg-green-950/60 dark:text-green-400",
    degrade: "from-green-100/90 dark:from-green-950/40",
  },
  roxo: {
    card: "border-purple-200/80 bg-gradient-to-br from-card to-purple-50/70 dark:border-purple-900/50 dark:to-purple-950/25",
    caixa: "bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400",
    degrade: "from-purple-100/90 dark:from-purple-950/40",
  },
  laranja: {
    card: "border-orange-200/80 bg-gradient-to-br from-card to-orange-50/70 dark:border-orange-900/50 dark:to-orange-950/25",
    caixa: "bg-orange-100 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400",
    degrade: "from-orange-100/90 dark:from-orange-950/40",
  },
  neutro: {
    card: "",
    caixa: "bg-muted text-muted-foreground",
    degrade: "from-muted",
  },
};

/** Moldura comum dos cartões do Financeiro (também usada pelo cartão com cadeado). */
export const MOLDURA_CARD_FINANCEIRO =
  "relative isolate min-w-0 overflow-hidden rounded-2xl p-3 sm:p-4 shadow-sm";
