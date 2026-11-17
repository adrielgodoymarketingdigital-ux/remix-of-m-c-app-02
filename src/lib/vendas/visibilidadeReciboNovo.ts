/**
 * Quem recebe o recibo de venda no layout novo (A4) e quem vê a tela
 * "Personalizar recibo de venda". ÚNICO ponto de decisão: os hooks de
 * src/hooks/useReciboVendaNovoVisivel.ts só chamam estas funções.
 *
 * Regra (opt-in por loja):
 *  - Recibo novo A4 (PDV, reimpressão em Vendas, Dispositivos vendidos, e a
 *    camada do iOS instalado, que imprime o que o diálogo escolheu): admin do
 *    MecApp SEMPRE; os demais só quando a linha de configuracoes_loja que o
 *    diálogo já leu (a da filial ou, sem linha própria, a da matriz; para
 *    funcionário, a do dono) tem recibo_venda_config preenchido (objeto).
 *    NULL, coluna ausente, valor que não é objeto, configuração ainda
 *    carregando ou que falhou → recibo de sempre, sem nenhuma diferença.
 *  - Tela "Personalizar": admin sempre; os demais só o DONO da loja.
 *    Funcionário e gerente de filial não veem o item (não podem salvar, e a
 *    prévia mostraria um layout que a loja talvez nem use).
 *  - "Restaurar padrão" + Salvar grava NULL: a loja volta ao recibo de sempre.
 *
 * FREIO DE EMERGÊNCIA: troque PERSONALIZACAO_RECIBO_VENDA_LIBERADA para false.
 * Tudo volta a ser só do admin (recibo novo e tela), inclusive para as lojas
 * que já personalizaram — o que elas salvaram fica guardado no banco e volta a
 * valer quando a constante voltar a true. Nada mais precisa mudar.
 * Documentado também em docs/recibo-venda-personalizacao.md.
 */

/** false = freio de emergência: recibo novo e tela "Personalizar" só para admin. */
export const PERSONALIZACAO_RECIBO_VENDA_LIBERADA = true;

/** Papel na loja; null/undefined = ainda carregando. */
export type PapelLojaRecibo = "dono" | "funcionario" | "gerente";

export interface ContextoReciboVendaNovo {
  isAdmin: boolean;
  /** Linha de configuracoes_loja que o diálogo de recibo já leu (null/undefined = carregando ou falhou). */
  loja?: { recibo_venda_config?: unknown } | null;
}

export interface ContextoTelaPersonalizarRecibo {
  isAdmin: boolean;
  papel: PapelLojaRecibo | null | undefined;
}

/**
 * true quando a loja salvou uma personalização: recibo_venda_config é um
 * objeto (o CHECK da coluna só aceita objeto ou NULL; o padrão é gravado como
 * NULL). Qualquer outra coisa (NULL, ausente, texto, número, lista) = não.
 */
export function lojaPersonalizouReciboVenda(loja: unknown): boolean {
  if (typeof loja !== "object" || loja === null) return false;
  const valor = (loja as { recibo_venda_config?: unknown }).recibo_venda_config;
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

/** Recibo novo A4 no lugar do de sempre? */
export function reciboVendaNovoVisivelPara(
  ctx: ContextoReciboVendaNovo,
  liberado: boolean = PERSONALIZACAO_RECIBO_VENDA_LIBERADA,
): boolean {
  if (ctx.isAdmin === true) return true;
  return liberado && lojaPersonalizouReciboVenda(ctx.loja);
}

/** Item "Personalizar recibo de venda" (menus do PDV e de Vendas, atalho em Configurações) visível? */
export function telaPersonalizarReciboVisivelPara(
  ctx: ContextoTelaPersonalizarRecibo,
  liberado: boolean = PERSONALIZACAO_RECIBO_VENDA_LIBERADA,
): boolean {
  if (ctx.isAdmin === true) return true;
  return liberado && ctx.papel === "dono";
}
