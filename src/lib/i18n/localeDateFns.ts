import type { Locale } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { IDIOMA_PADRAO, type Idioma } from "./idiomas";

/**
 * Locale do date-fns por idioma. ptBR é o de sempre (já está no pacote de
 * quem usa date-fns em pt-BR); es, en e it vêm por import() — cada um num
 * chunk baixado só quando pedido. Ninguém chama isto ainda: é para a etapa 5
 * (format(..., { locale })) e para o calendário (react-day-picker).
 */
const CARREGADORES: Record<Exclude<Idioma, "pt-BR">, () => Promise<Locale>> = {
  es: () => import("date-fns/locale/es").then((m) => m.es),
  en: () => import("date-fns/locale/en-US").then((m) => m.enUS),
  it: () => import("date-fns/locale/it").then((m) => m.it),
};

const carregados: Partial<Record<Idioma, Locale>> = { [IDIOMA_PADRAO]: ptBR };

/** O locale, se já estiver carregado (pt-BR sempre está); senão null. */
export function localeDateFnsCarregado(idioma: Idioma): Locale | null {
  return carregados[idioma] ?? null;
}

export async function carregarLocaleDateFns(idioma: Idioma): Promise<Locale> {
  const pronto = carregados[idioma];
  if (pronto) return pronto;
  const locale = await CARREGADORES[idioma as Exclude<Idioma, "pt-BR">]();
  carregados[idioma] = locale;
  return locale;
}
