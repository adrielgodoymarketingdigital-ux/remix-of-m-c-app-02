/**
 * Quem vê a tela "Minhas garantias" (Dispositivos → Configurações).
 * ÚNICO ponto de decisão, no mesmo esquema de src/lib/vendas/visibilidadeReciboNovo.ts:
 * o hook useTelaMinhasGarantiasVisivel só chama esta função.
 *
 * FASE A: MINHAS_GARANTIAS_LIBERADA = false → SÓ o admin do MecApp vê o item
 * e o diálogo. Usuário comum (dono, funcionário, gerente) não vê nada, e nada
 * da venda, recibos ou catálogo usa as garantias novas.
 *
 * Quando liberar (fase B em diante): true → admin sempre; dos demais, só o
 * DONO da loja (funcionário e gerente de filial não editam garantias).
 * Admin vem do cache do menu; carregando = false (não mostra).
 */

/** false = só admin (fase A / freio de emergência). */
export const MINHAS_GARANTIAS_LIBERADA = false;

export type PapelLojaGarantias = "dono" | "funcionario" | "gerente";

export interface ContextoTelaMinhasGarantias {
  isAdmin: boolean;
  papel: PapelLojaGarantias | null | undefined;
}

export function telaMinhasGarantiasVisivelPara(
  ctx: ContextoTelaMinhasGarantias,
  liberado: boolean = MINHAS_GARANTIAS_LIBERADA,
): boolean {
  if (ctx.isAdmin === true) return true;
  return liberado && ctx.papel === "dono";
}
