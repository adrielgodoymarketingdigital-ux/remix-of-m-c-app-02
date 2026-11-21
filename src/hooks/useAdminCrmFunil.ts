import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizarLinhaFunil, type LinhaFunilWhatsApp } from "@/lib/marketing/custoWhatsApp";
import {
  classificarErroFunil,
  normalizarForaDoFunil,
  normalizarLancamentos,
  normalizarLinhasAnuncio,
  type EstadoErroFunil,
  type ForaDoFunil,
  type LancamentoGasto,
  type LinhaAnuncio,
} from "@/lib/marketing/funilWhatsApp";
import { centavosParaDecimal } from "@/lib/marketing/metaAds";

/**
 * Card "Funil do WhatsApp" (/admin/marketing). Só admin: as RPCs recusam quem
 * não é (has_role). As funções e a tabela crm_gasto_manual ainda não estão em
 * src/integrations/supabase/types.ts, por isso o `as never` (mesmo padrão de
 * useAdminMarketingOrigens).
 *
 * Antes do SQL da fase 1 ser aplicado, a 1ª chamada (admin_crm_funil) falha
 * com "função não existe": o erro vira ErroFunilWhatsApp("nao_ativado"), sem
 * nova tentativa e sem log no console, e as outras consultas nem são feitas
 * (só rodam depois que o funil respondeu).
 */
export class ErroFunilWhatsApp extends Error {
  constructor(readonly estado: EstadoErroFunil, readonly code: string | null, message: string) {
    super(message);
  }
}

function erroDe(e: { code?: string | null; message?: string | null }): ErroFunilWhatsApp {
  return new ErroFunilWhatsApp(classificarErroFunil(e), e.code ?? null, e.message ?? "");
}

const naoRepetirSeNaoAtivado = (tentativas: number, erro: unknown) =>
  !(erro instanceof ErroFunilWhatsApp && erro.estado !== "falha") && tentativas < 1;

export interface Intervalo { inicio: string; fim: string }

export function useAdminCrmFunil(intervalo: Intervalo | null) {
  return useQuery({
    queryKey: ["admin-crm-funil", intervalo?.inicio, intervalo?.fim],
    enabled: intervalo !== null,
    // Mantém o período anterior na tela enquanto o novo carrega (o mesmo que
    // keepPreviousData, sem puxar mais um export do React Query para o vendor).
    placeholderData: (anterior: LinhaFunilWhatsApp | undefined) => anterior,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: naoRepetirSeNaoAtivado,
    queryFn: async (): Promise<LinhaFunilWhatsApp> => {
      const { data, error } = await supabase.rpc(
        "admin_crm_funil" as never,
        { p_inicio: intervalo!.inicio, p_fim: intervalo!.fim } as never,
      );
      if (error) throw erroDe(error);
      const linhas = (data ?? []) as unknown as Record<string, unknown>[];
      return normalizarLinhaFunil(linhas[0]);
    },
  });
}

export function useAdminCrmFunilPorAnuncio(intervalo: Intervalo | null, habilitado: boolean) {
  return useQuery({
    queryKey: ["admin-crm-funil-anuncio", intervalo?.inicio, intervalo?.fim],
    enabled: habilitado && intervalo !== null,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: naoRepetirSeNaoAtivado,
    queryFn: async (): Promise<LinhaAnuncio[]> => {
      const { data, error } = await supabase.rpc(
        "admin_crm_funil_por_anuncio" as never,
        { p_inicio: intervalo!.inicio, p_fim: intervalo!.fim } as never,
      );
      if (error) throw erroDe(error);
      return normalizarLinhasAnuncio(data);
    },
  });
}

/**
 * Quem ficou fora do funil no período (fase 1C): a loja chamou primeiro ou
 * direção desconhecida. Se o SQL da 1C ainda não foi aplicado, a função não
 * existe: o erro vira "nao_ativado", sem nova tentativa, e o card só esconde
 * a linha.
 */
export function useAdminCrmFunilExcluidos(intervalo: Intervalo | null, habilitado: boolean) {
  return useQuery({
    queryKey: ["admin-crm-funil-excluidos", intervalo?.inicio, intervalo?.fim],
    enabled: habilitado && intervalo !== null,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: naoRepetirSeNaoAtivado,
    queryFn: async (): Promise<ForaDoFunil> => {
      const { data, error } = await supabase.rpc(
        "admin_crm_funil_excluidos" as never,
        { p_inicio: intervalo!.inicio, p_fim: intervalo!.fim } as never,
      );
      if (error) throw erroDe(error);
      return normalizarForaDoFunil(data);
    },
  });
}

/** Lançamentos ativos de gasto informado (RLS: só admin lê). */
export function useAdminCrmGastos(habilitado: boolean) {
  return useQuery({
    queryKey: ["admin-crm-gastos"],
    enabled: habilitado,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: naoRepetirSeNaoAtivado,
    queryFn: async (): Promise<LancamentoGasto[]> => {
      const { data, error } = await supabase
        .from("crm_gasto_manual" as never)
        .select("id, inicio, fim, ad_id, descricao, valor, removido_em")
        .is("removido_em" as never, null)
        .order("inicio" as never, { ascending: false })
        .limit(50);
      if (error) throw erroDe(error);
      return normalizarLancamentos(data);
    },
  });
}

function useInvalidarFunil() {
  const qc = useQueryClient();
  return () => Promise.all([
    qc.invalidateQueries({ queryKey: ["admin-crm-funil"] }),
    qc.invalidateQueries({ queryKey: ["admin-crm-funil-anuncio"] }),
    qc.invalidateQueries({ queryKey: ["admin-crm-gastos"] }),
  ]);
}

export interface NovoGasto { inicio: string; fim: string; valorCentavos: number; adId: string | null; descricao: string | null }

export function useInformarGastoWhatsApp() {
  const invalidar = useInvalidarFunil();
  return useMutation({
    mutationFn: async (g: NovoGasto): Promise<number> => {
      const { data, error } = await supabase.rpc(
        "admin_crm_gasto_informar" as never,
        {
          p_inicio: g.inicio,
          p_fim: g.fim,
          // texto "1240.55": numeric exato, sem passar por float
          p_valor: centavosParaDecimal(g.valorCentavos),
          p_ad_id: g.adId,
          p_descricao: g.descricao,
        } as never,
      );
      if (error) throw erroDe(error);
      return Number(data);
    },
    onSuccess: () => invalidar(),
  });
}

export function useRemoverGastoWhatsApp() {
  const invalidar = useInvalidarFunil();
  return useMutation({
    mutationFn: async (id: number): Promise<boolean> => {
      const { data, error } = await supabase.rpc("admin_crm_gasto_remover" as never, { p_id: id } as never);
      if (error) throw erroDe(error);
      return data === true;
    },
    onSuccess: () => invalidar(),
  });
}
