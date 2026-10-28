// Regra única de "estoque baixo" de produtos e peças.
//
// O limite é "avisar quando restar X ou menos": com limite 4, de 1 a 4 é baixo.
// Limite 0 = nunca avisar baixo. Zero e negativo são fixos e não dependem do limite.
//
// Cada tela tem o seu padrão histórico (abaixo). O limite da loja (fase 2, tabela
// configuracao_estoque) entra como `limite`; sem configuração ele vem vazio e o
// resultado é o mesmo de antes.
// A quantidade em produtos/pecas é INTEGER no banco; por isso "1 a 4" e "4 ou menos"
// dão o mesmo resultado.

export type SituacaoEstoque = "negativo" | "sem_estoque" | "baixo" | "ok";

/** Lista de Produtos/Peças (celular e computador): baixo de 1 a 4, "Em estoque" a partir de 5. */
export const LIMITE_PADRAO_LISTA_PRODUTOS = 4;
/** PDF "Menor estoque": cartão "Estoque Baixo" conta de 1 a 3. */
export const LIMITE_PADRAO_PDF_MENOR_ESTOQUE = 3;
/** Relatório de produtos vendidos: vermelho quando o estoque é menor que 5 (inclui zero e negativo). */
export const LIMITE_PADRAO_RELATORIO_VENDIDOS = 4;

/** Limite configurado só vale se for número inteiro maior ou igual a 0; senão usa o padrão da tela. */
function limiteValido(limite: number | null | undefined): limite is number {
  return typeof limite === "number" && Number.isInteger(limite) && limite >= 0;
}

/** Limite que vale na tela: o configurado, se válido; senão o padrão da tela. */
export function limiteEfetivo(limite: number | null | undefined, limitePadrao: number): number {
  return limiteValido(limite) ? limite : limitePadrao;
}

/** Subtítulo do cartão "Estoque Baixo" do PDF "Menor estoque" (sem configuração: "quantidade 1 a 3"). */
export function descricaoFaixaBaixoPDF(limite: number | null | undefined): string {
  const efetivo = limiteEfetivo(limite, LIMITE_PADRAO_PDF_MENOR_ESTOQUE);
  if (efetivo === 0) return "aviso desligado";
  if (efetivo === 1) return "quantidade 1";
  return `quantidade 1 a ${efetivo}`;
}

/**
 * @param quantidade quantidade em estoque; vazio ou inválido conta como 0.
 * @param limite limite configurado (item ou loja, nas próximas fases); vazio = padrão da tela.
 * @param limitePadrao limite histórico da tela que chama.
 */
export function situacaoEstoque(
  quantidade: number | null | undefined,
  limite: number | null | undefined,
  limitePadrao: number,
): SituacaoEstoque {
  const qtd = typeof quantidade === "number" && Number.isFinite(quantidade) ? quantidade : 0;
  if (qtd < 0) return "negativo";
  if (qtd === 0) return "sem_estoque";
  return qtd <= limiteEfetivo(limite, limitePadrao) ? "baixo" : "ok";
}
