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

// Limpa o cache apenas quando o usuário realmente troca (não em TOKEN_REFRESHED)
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT' || event === 'SIGNED_IN' || event === 'USER_UPDATED') {
    gerenteCache = undefined;
  }
});

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Só atualiza em troca real de usuário, não em renovação de token
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION') {
        setSelfId(session?.user?.id ?? null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Gerente de filial tem prioridade — mesmo que tenha empresa própria
  if (gerenteData?.proprietario_id) {
    return gerenteData.proprietario_id;
  }

  // Funcionário comum (loja_funcionarios)
  if (isFuncionario && lojaUserId) {
    return lojaUserId;
  }

  return selfId;
}

/**
 * Aplica filtro de empresa_id numa query Supabase.
 * - Filial: filtra exatamente pelo empresa_id (sem incluir IS NULL)
 * - Matriz: inclui IS NULL para capturar registros legados sem empresa_id
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyEmpresaFilter<T extends { or: (filter: string) => T; eq: (col: string, val: string) => T }>(
  query: T,
  empresaId: string | null,
  isFilial: boolean
): T {
  if (!empresaId) return query;
  if (isFilial) {
    return query.eq('empresa_id', empresaId);
  }
  return query.or(`empresa_id.eq.${empresaId},empresa_id.is.null`);
}

/**
 * Retorna o empresa_id para filtrar nas queries.
 * - Proprietário com filial selecionada → empresaAtiva (filial)
 * - Proprietário sem filial selecionada → matrizId (evita ver dados das filiais)
 * - Gerente de filial logado → empresa_id da filial que gerencia
 * - Demais casos → null (sem filtro por empresa)
 */
export function useEmpresaFiltro(): string | null {
  const { isProprietario, empresaAtiva, matrizId } = useEmpresa();
  const gerenteData = useGerenteFilialData();

  // Gerente de filial tem prioridade sobre isProprietario
  if (gerenteData?.empresa_id) {
    return gerenteData.empresa_id;
  }

  if (isProprietario) {
    return empresaAtiva ?? matrizId ?? null;
  }

  return null;
}

/**
 * Retorna { empresaId, isFilial } para queries que precisam saber se é contexto de filial.
 * isFilial = true → filtrar exatamente por empresa_id (sem IS NULL)
 * isFilial = false → incluir IS NULL para capturar registros legados
 */
export function useEmpresaInfo(): { empresaId: string | null; isFilial: boolean } {
  const { isProprietario, empresaAtiva, matrizId } = useEmpresa();
  const gerenteData = useGerenteFilialData();

  if (gerenteData?.empresa_id) {
    return { empresaId: gerenteData.empresa_id, isFilial: true };
  }

  if (isProprietario) {
    return {
      empresaId: empresaAtiva ?? matrizId ?? null,
      isFilial: empresaAtiva !== null,
    };
  }

  return { empresaId: null, isFilial: false };
}

/**
 * Retorna { userId, empresaId, carregando } de forma consolidada.
 * carregando = true enquanto o perfil de gerente de filial ainda não foi resolvido.
 * Use para evitar disparar queries com userId/empresaId provisórios.
 */
export function useIdentidade(): { userId: string | null; empresaId: string | null; carregando: boolean; isFilial: boolean } {
  const { isProprietario, empresaAtiva, matrizId } = useEmpresa();
  const { lojaUserId, isFuncionario, funcionarioEmpresaId } = useFuncionarioPermissoes();
  const gerenteData = useGerenteFilialData();
  const [selfId, setSelfId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setSelfId(user?.id ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION') {
        setSelfId(session?.user?.id ?? null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Gerente de filial tem prioridade — mesmo que tenha empresa própria (isProprietario = true)
  const carregando = gerenteData === undefined;

  let userId: string | null = selfId;
  let empresaId: string | null = null;
  let isFilial = false;

  if (gerenteData?.proprietario_id) {
    // Gerente de filial de outro proprietário → usa dados do proprietário
    userId = gerenteData.proprietario_id;
    empresaId = gerenteData.empresa_id;
    isFilial = true;
  } else if (isFuncionario && lojaUserId) {
    userId = lojaUserId;
    // Funcionário vinculado a uma empresa específica → filtrar por ela
    if (funcionarioEmpresaId) {
      empresaId = funcionarioEmpresaId;
    }
  } else if (isProprietario) {
    // Sempre aplica filtro de empresa quando há matrizId — garante que vendas
    // de filiais (empresa_id = filial_id) não apareçam na visão da matriz
    empresaId = empresaAtiva ?? matrizId ?? null;
    isFilial = empresaAtiva !== null;
  }

  return { userId, empresaId, carregando, isFilial };
}
