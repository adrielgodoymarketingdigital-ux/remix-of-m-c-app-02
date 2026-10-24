import { supabase } from "@/integrations/supabase/client";
import { type ConsultaFiltravel, contarApagados, type FiltroApagados } from "@/lib/assinatura/cotaComApagados";

/**
 * Consulta de contagem dos fantasmas do Começar do zero (cota_registros_apagados).
 * Conversão via unknown: o builder do supabase-js tem eq/in/gte/lte/lt, mas a
 * checagem estrutural dos tipos gerados estoura o limite do TypeScript (TS2589).
 */
const abrirApagados = () =>
  supabase.from("cota_registros_apagados").select("id", { count: "exact", head: true }) as unknown as ConsultaFiltravel;

/** Fantasmas de `userId` que contam nesta cota (a RLS só mostra os do próprio usuário). Erro vale 0. */
export const contarApagadosDaCota = (userId: string, filtro: FiltroApagados) =>
  contarApagados(abrirApagados, userId, filtro);
