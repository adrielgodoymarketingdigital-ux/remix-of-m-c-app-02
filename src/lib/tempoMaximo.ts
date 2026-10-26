/**
 * Tempo máximo para uma promessa: se não terminar em `ms`, resolve com o que
 * `aoEsgotar` devolver (a promessa original segue sozinha e é ignorada). Erro
 * da promessa continua sendo erro. Sem import nenhum (testável no Deno).
 */
export function comTempoMaximo<T>(promessa: Promise<T>, ms: number, aoEsgotar: () => T): Promise<T> {
  let id: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<T>((resolve) => {
    id = setTimeout(() => resolve(aoEsgotar()), ms);
  });
  return Promise.race([promessa, limite]).finally(() => clearTimeout(id));
}

/** Recibo novo: kit, leitura da venda e configuração da loja esperam no máximo isto; depois, recibo antigo. */
export const TEMPO_MAXIMO_RECIBO_NOVO_MS = 8000;
