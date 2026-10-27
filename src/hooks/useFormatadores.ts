import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Locale } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useI18nVisivel } from "@/hooks/useI18nVisivel";
import { useMercado } from "@/hooks/useMercado";
import {
  FORMATO_NAVEGADOR_BRASIL,
  formatarData,
  formatarDataHora,
  formatarHora,
  formatarMoeda,
  formatarNumero,
  type ContextoFormato,
} from "@/lib/i18n/formatadores";
import type { Idioma } from "@/lib/i18n/idiomas";
import { localeDateFnsCarregado } from "@/lib/i18n/localeDateFns";

export interface Formatadores {
  ctx: ContextoFormato;
  moeda: (valor: number | null | undefined) => string;
  numero: (valor: number, opcoes?: Intl.NumberFormatOptions) => string;
  data: (valor: string | Date | number) => string;
  hora: (valor: string | Date | number) => string;
  dataHora: (valor: string | Date | number) => string;
  /** Para format(..., { locale }) do date-fns (nomes de mês e dia). */
  localeDateFns: Locale;
}

/**
 * Formatadores centrais já ligados à conta. Quem não tem i18n (hoje: todo
 * não-admin) recebe FORMATO_NAVEGADOR_BRASIL — pt-BR, BRL e a hora no fuso do
 * navegador, exatamente como formatCurrency/formatDate/date-fns fazem hoje.
 * Com i18n, o idioma é o que já está APLICADO no i18next (igual ao dos
 * textos), com a moeda, o país e o fuso da conta.
 */
export function useFormatadores(): Formatadores {
  const visivel = useI18nVisivel();
  const { moeda, pais, fuso } = useMercado();
  const { i18n } = useTranslation();
  const idioma = i18n.language as Idioma;

  return useMemo(() => {
    const ctx: ContextoFormato = visivel ? { idioma, moeda, pais, fuso } : FORMATO_NAVEGADOR_BRASIL;
    return {
      ctx,
      moeda: (valor) => formatarMoeda(valor, ctx),
      numero: (valor, opcoes) => formatarNumero(valor, opcoes, ctx),
      data: (valor) => formatarData(valor, ctx),
      hora: (valor) => formatarHora(valor, ctx),
      dataHora: (valor) => formatarDataHora(valor, ctx),
      localeDateFns: localeDateFnsCarregado(ctx.idioma) ?? ptBR,
    };
  }, [visivel, idioma, moeda, pais, fuso]);
}
