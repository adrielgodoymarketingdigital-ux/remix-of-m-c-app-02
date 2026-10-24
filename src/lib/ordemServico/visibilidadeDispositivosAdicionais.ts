/**
 * Quem vê, no assistente da OS, os dispositivos adicionais ("Outros aparelhos
 * desta OS", "+ Novo dispositivo" e o aparelho de cada serviço) — etapa 5b da
 * OS com vários dispositivos. ÚNICA regra: useDispositivosAdicionaisOSVisivel
 * só chama isto. Quem não vê também não lê nem grava a tabela
 * os_dispositivos_adicionais pelo assistente.
 *
 * Hoje: só admin do MecApp (liberação admin-first). Para liberar a todos
 * (etapa 5c), devolva true. Para esconder de todo mundo, devolva false.
 */
export interface ContextoDispositivosAdicionaisOS {
  isAdmin: boolean;
}

export function dispositivosAdicionaisOSVisivelPara(ctx: ContextoDispositivosAdicionaisOS): boolean {
  return ctx.isAdmin;
}
