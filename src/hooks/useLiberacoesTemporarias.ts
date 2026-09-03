import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type LiberacaoEstado = "ativa" | "revertida" | "revogada_manual" | "conflito_sem_reverter";

export interface LiberacaoTemporaria {
  id: string;
  user_id: string;
  email: string | null;
  admin_id: string;
  plano_concedido: string;
  status_concedido: string;
  concedido_em: string;
  expira_em: string;
  duracao_texto: string | null;
  plano_anterior: string | null;
  status_anterior: string | null;
  era_pagante_real: boolean;
  estado: LiberacaoEstado;
  revertido_em: string | null;
  revertido_por: string | null;
  motivo: string | null;
}

export interface UsuarioLookup {
  user_id: string;
  email: string;
  nome: string | null;
  plano_tipo: string | null;
  status: string | null;
  data_fim: string | null;
  era_pagante_real: boolean;
  liberacao_ativa: { id: string; plano_concedido: string; expira_em: string } | null;
}

export interface LiberarAcessoInput {
  user_id: string;
  plano_tipo: string;
  duracao_valor: number;
  duracao_unidade: "horas" | "dias";
  motivo?: string;
  confirmar_pagante_ativo?: boolean;
}

export type LiberarAcessoResultado =
  | { ok: true; liberacao_id: string; expira_em: string; message: string }
  | { ok: false; requerConfirmacao: boolean; message: string };

const SELECT_COLS =
  "id, user_id, email, admin_id, plano_concedido, status_concedido, concedido_em, expira_em, duracao_texto, plano_anterior, status_anterior, era_pagante_real, estado, revertido_em, revertido_por, motivo";

/** Extrai a mensagem de erro do corpo JSON de uma resposta não-2xx de Edge Function. */
async function mensagemDoErro(error: unknown): Promise<string | null> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as { error?: string };
      return body?.error ?? null;
    } catch {
      return null;
    }
  }
  return error instanceof Error ? error.message : null;
}

export function useLiberacoesTemporarias() {
  const queryClient = useQueryClient();

  const ativasQuery = useQuery({
    queryKey: ["liberacoes-temporarias", "ativas"],
    queryFn: async (): Promise<LiberacaoTemporaria[]> => {
      const { data, error } = await supabase
        .from("liberacoes_temporarias")
        .select(SELECT_COLS)
        .eq("estado", "ativa")
        .order("expira_em", { ascending: true });
      if (error) throw error;
      return (data ?? []) as LiberacaoTemporaria[];
    },
    refetchInterval: 60_000,
  });

  const historicoQuery = useQuery({
    queryKey: ["liberacoes-temporarias", "historico"],
    queryFn: async (): Promise<LiberacaoTemporaria[]> => {
      const { data, error } = await supabase
        .from("liberacoes_temporarias")
        .select(SELECT_COLS)
        .neq("estado", "ativa")
        .order("concedido_em", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as LiberacaoTemporaria[];
    },
  });

  const recarregar = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["liberacoes-temporarias"] });
  }, [queryClient]);

  const buscarUsuarioPorEmail = useCallback(async (email: string): Promise<UsuarioLookup | null> => {
    const { data, error } = await supabase.functions.invoke("admin-buscar-usuario-email", {
      body: { email: email.trim().toLowerCase() },
    });
    if (error) {
      toast.error((await mensagemDoErro(error)) || "Erro ao buscar usuário");
      return null;
    }
    if ((data as { error?: string })?.error) {
      toast.error((data as { error: string }).error);
      return null;
    }
    return data as UsuarioLookup;
  }, []);

  const liberarAcesso = useCallback(
    async (input: LiberarAcessoInput): Promise<LiberarAcessoResultado> => {
      const { data, error } = await supabase.functions.invoke("admin-liberar-acesso-temporario", {
        body: input,
      });

      if (error) {
        const msg = (await mensagemDoErro(error)) || "Erro ao liberar acesso";
        toast.error(msg);
        return { ok: false, requerConfirmacao: false, message: msg };
      }

      const payload = (data ?? {}) as {
        success?: boolean;
        requer_confirmacao?: boolean;
        message?: string;
        liberacao_id?: string;
        expira_em?: string;
      };

      if (payload.requer_confirmacao) {
        return {
          ok: false,
          requerConfirmacao: true,
          message: payload.message || "Confirmação necessária",
        };
      }

      toast.success(payload.message || "Acesso liberado com sucesso!");
      recarregar();
      return {
        ok: true,
        liberacao_id: payload.liberacao_id!,
        expira_em: payload.expira_em!,
        message: payload.message || "",
      };
    },
    [recarregar],
  );

  const revogarLiberacao = useCallback(
    async (liberacaoId: string): Promise<boolean> => {
      const { error } = await supabase.functions.invoke("reverter-liberacoes-temporarias", {
        body: { liberacao_id: liberacaoId },
      });
      if (error) {
        toast.error((await mensagemDoErro(error)) || "Erro ao revogar liberação");
        return false;
      }
      toast.success("Liberação revogada. Estado anterior restaurado.");
      recarregar();
      return true;
    },
    [recarregar],
  );

  return {
    liberacoesAtivas: ativasQuery.data ?? [],
    historico: historicoQuery.data ?? [],
    isLoading: ativasQuery.isLoading,
    isLoadingHistorico: historicoQuery.isLoading,
    recarregar,
    buscarUsuarioPorEmail,
    liberarAcesso,
    revogarLiberacao,
  };
}
