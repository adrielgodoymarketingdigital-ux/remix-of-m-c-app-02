import { useEmpresa } from "@/contexts/EmpresaContext";
import { useFuncionarioPermissoes } from "./useFuncionarioPermissoes";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface GerenteFilialData {
  proprietario_id: string;
  empresa_id: string;
}

// Cache compartilhado entre useResolvedUserId e useEmpresaFiltro para evitar
// duas queries paralelas ao mesmo endpoint.
let gerenteCache: GerenteFilialData | null | undefined = undefined;
const gerenteCacheListeners: Array<(data: GerenteFilialData | null) => void> = [];

async function resolveGerenteFilial(): Promise<GerenteFilialData | null> {
  if (gerenteCache !== undefined) return gerenteCache;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { gerenteCache = null; return null; }

  const { data } = await supabase
    .from("empresa_usuarios")
    .select("proprietario_id, empresa_id")
    .eq("gerente_id", user.id)
    .maybeSingle();

  gerenteCache = data ? { proprietario_id: data.proprietario_id, empresa_id: data.empresa_id } : null;
  gerenteCacheListeners.forEach(fn => fn(gerenteCache as GerenteFilialData | null));
  gerenteCacheListeners.length = 0;
  return gerenteCache;
}

// Limpa o cache quando o usuário troca de sessão
supabase.auth.onAuthStateChange(() => { gerenteCache = undefined; });

function useGerenteFilialData(): GerenteFilialData | null | undefined {
  const { isProprietario } = useEmpresa();
  const [data, setData] = useState<GerenteFilialData | null | undefined>(
    isProprietario ? null : gerenteCache
  );

  useEffect(() => {
    if (isProprietario) { setData(null); return; }

    if (gerenteCache !== undefined) { setData(gerenteCache); return; }

    let cancelled = false;
    resolveGerenteFilial().then(result => { if (!cancelled) setData(result); });
    return () => { cancelled = true; };
  }, [isProprietario]);

  return data;
}

/**
 * Resolve qual user_id usar nas queries, em ordem de prioridade:
 * 1. Gerente de filial logado → proprietario_id (dados salvos com esse ID)
 * 2. Funcionário logado → lojaUserId (dono da loja onde trabalha)
 * 3. Proprietário / usuário normal → próprio user.id
 */
export function useResolvedUserId(): string | null {
  const { isProprietario } = useEmpresa();
  const { lojaUserId, isFuncionario } = useFuncionarioPermissoes();
  const gerenteData = useGerenteFilialData();
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

  // Gerente de filial: dados salvos com user_id = proprietario_id
  if (!isProprietario && gerenteData?.proprietario_id) {
    return gerenteData.proprietario_id;
  }

  // Funcionário comum (loja_funcionarios)
  if (isFuncionario && lojaUserId) {
    return lojaUserId;
  }

  return selfId;
}

/**
 * Retorna o empresa_id para filtrar nas queries.
 * - Proprietário com filial selecionada → empresaAtiva
 * - Gerente de filial logado → empresa_id da filial que gerencia
 * - Demais casos → null (sem filtro por empresa)
 */
export function useEmpresaFiltro(): string | null {
  const { isProprietario, empresaAtiva } = useEmpresa();
  const gerenteData = useGerenteFilialData();

  if (isProprietario) {
    return empresaAtiva ?? null;
  }

  // undefined = ainda carregando, retorna null provisoriamente
  return gerenteData?.empresa_id ?? null;
}
