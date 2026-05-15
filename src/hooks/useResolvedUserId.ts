import { useEmpresa } from "@/contexts/EmpresaContext";
import { useFuncionarioPermissoes } from "./useFuncionarioPermissoes";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve qual user_id usar nas queries, em ordem de prioridade:
 * 1. Proprietário com filial selecionada → proprietario_id (dados filtrados por empresa_id via useEmpresaFiltro)
 * 2. Funcionário logado → lojaUserId (dono da loja onde trabalha)
 * 3. Usuário normal → próprio user.id
 *
 * NOTA: quando proprietário visualiza filial, os dados estão salvos com user_id = proprietario_id.
 * O filtro por empresa_id é feito separadamente via useEmpresaFiltro().
 */
export function useResolvedUserId(): string | null {
  const { isProprietario, empresaAtiva, userIdAtivo } = useEmpresa();
  const { lojaUserId, isFuncionario } = useFuncionarioPermissoes();
  const [selfId, setSelfId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setSelfId(user?.id ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSelfId(session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Proprietário visualizando uma filial: retorna o próprio proprietario_id
  // (os dados estão salvos com user_id = proprietario_id, filtrados por empresa_id)
  if (isProprietario && empresaAtiva) {
    return selfId;
  }

  // Funcionário vê dados da loja onde trabalha
  if (isFuncionario && lojaUserId) {
    return lojaUserId;
  }

  return selfId;
}

/**
 * Retorna o empresa_id para filtrar nas queries quando o proprietário
 * estiver visualizando uma filial específica. Retorna null quando está
 * na matriz (sem filtro por empresa) ou quando não é proprietário.
 */
export function useEmpresaFiltro(): string | null {
  const { isProprietario, empresaAtiva } = useEmpresa();
  const result = (isProprietario && empresaAtiva) ? empresaAtiva : null;
  console.log('[useEmpresaFiltro] isProprietario:', isProprietario, '| empresaAtiva:', empresaAtiva, '| result:', result);
  return result;
}
