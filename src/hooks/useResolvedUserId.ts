import { useEmpresa } from "@/contexts/EmpresaContext";
import { useFuncionarioPermissoes } from "./useFuncionarioPermissoes";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve qual user_id usar nas queries, em ordem de prioridade:
 * 1. Proprietário com filial selecionada → userIdAtivo (gerente da filial)
 * 2. Funcionário logado → lojaUserId (dono da loja onde trabalha)
 * 3. Usuário normal → próprio user.id
 */
export function useResolvedUserId(): string | null {
  const { userIdAtivo, isProprietario, empresaAtiva } = useEmpresa();
  const { lojaUserId, isFuncionario } = useFuncionarioPermissoes();
  const [selfId, setSelfId] = useState<string | null>(null);

  useEffect(() => {
    // Usar getUser() é mais confiável que getSession() — verifica o token com o servidor
    supabase.auth.getUser().then(({ data: { user } }) => {
      setSelfId(user?.id ?? null);
    });

    // Também subscrever mudanças de auth para atualizar selfId em tempo real
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSelfId(session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Proprietário visualizando uma filial específica — só redireciona se tiver userIdAtivo válido
  if (isProprietario && empresaAtiva && userIdAtivo) {
    return userIdAtivo;
  }

  // Funcionário vê dados da loja onde trabalha
  if (isFuncionario && lojaUserId) {
    return lojaUserId;
  }

  return selfId;
}
