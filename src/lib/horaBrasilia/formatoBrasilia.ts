/**
 * Data e hora na tela: no fuso da conta quando ela tem um; nos demais casos, em
 * Brasília. Não depende do fuso configurado no aparelho.
 */
import {
  FORMATO_BRASIL,
  formatarData,
  formatarDataHora,
  formatarHora,
  type ContextoFormato,
} from "../i18n/formatadores.ts";

export const FUSO_BRASILIA = "America/Sao_Paulo";

export const noFusoDaConta = (ctx: ContextoFormato): ContextoFormato =>
  ctx.fuso ? ctx : { ...ctx, fuso: FUSO_BRASILIA };

export const formatarDataHoraDaConta = (valor: string | Date | number, ctx: ContextoFormato): string =>
  formatarDataHora(valor, noFusoDaConta(ctx));

/** "18/11/2026 às 14:30", o formato do recibo do PDV. */
export function formatarDataHoraRecibo(valor: string | Date | number, ctx: ContextoFormato): string {
  const contexto: ContextoFormato = { ...FORMATO_BRASIL, fuso: noFusoDaConta(ctx).fuso };
  return `${formatarData(valor, contexto)} às ${formatarHora(valor, contexto)}`;
}
