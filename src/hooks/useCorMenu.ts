/**
 * Cor do menu (barra lateral + barra inferior) da LOJA.
 *
 * Lê de configuracoes_loja a linha da matriz do dono da loja (lojaUserId):
 * para o dono é ele mesmo; para o funcionário é o dono (a policy "Funcionarios
 * veem config loja do dono" libera o SELECT). Ao chegar, aplica no <html>; a
 * última cor já foi aplicada antes do primeiro render (main.tsx), então aqui é
 * só a reconciliação. Erro de leitura: mantém o que está aplicado.
 */
import { useEffect, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { linhaDeReferencia } from "@/lib/configuracaoLoja/coresPersonalizadasLinhas";
import { corMenuDasCores } from "@/lib/menu/corMenu";
import { aplicarCorMenu, assinarCorMenu, corMenuAplicada } from "@/lib/menu/aplicarCorMenu";

export const CHAVE_QUERY_COR_MENU = "cor-menu";

export function useCorMenu() {
  const { lojaUserId } = useFuncionarioPermissoes();

  const { data } = useQuery({
    queryKey: [CHAVE_QUERY_COR_MENU, lojaUserId],
    enabled: !!lojaUserId,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<string | null> => {
      const { data: linhas, error } = await supabase
        .from("configuracoes_loja")
        .select("empresa_id, cores_personalizadas")
        .eq("user_id", lojaUserId as string);
      if (error) throw error;
      return corMenuDasCores(linhaDeReferencia(linhas)?.cores_personalizadas);
    },
  });

  useEffect(() => {
    if (data !== undefined) aplicarCorMenu(data);
  }, [data]);
}

/** Cor do menu aplicada agora (null = padrão do CSS). */
export function useCorMenuAplicada(): string | null {
  return useSyncExternalStore(assinarCorMenu, corMenuAplicada, () => null);
}
