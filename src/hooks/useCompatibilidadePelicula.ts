import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { withRetry } from "@/lib/supabase-retry";
import {
  GrupoCompatibilidadeComModelos,
  GrupoCompatibilidadePelicula,
} from "@/types/compatibilidade-pelicula";
import {
  TipoCompatibilidade,
  ehErroColunaTipoAusente,
  tipoDoGrupo,
} from "@/lib/compatibilidade/compatibilidade";

const TABELA_GRUPOS = "grupos_compatibilidade_pelicula";
// Modelos embutidos no grupo: uma requisição só e sem o teto de 1000 linhas do
// PostgREST na lista plana de modelos (películas + vidros passam de 1000).
const SELECT_GRUPOS = "*, modelos:grupo_compatibilidade_modelos(*)";

/** Mensagem para o admin quando a aba Vidros é usada antes da migration da coluna tipo. */
const MSG_SEM_COLUNA_TIPO = "A compatibilidade de vidros ainda não foi ativada no banco (falta a migration da coluna tipo).";

async function carregarGruposComModelos(tipo: TipoCompatibilidade): Promise<GrupoCompatibilidadeComModelos[]> {
  const comTipo = await supabase
    .from(TABELA_GRUPOS)
    .select(SELECT_GRUPOS)
    .eq("tipo", tipo)
    .order("criado_em", { ascending: false });

  let dados = comTipo.data;
  if (comTipo.error) {
    if (!ehErroColunaTipoAusente(comTipo.error)) throw comTipo.error;
    // Front publicado antes da migration: tudo o que existe é película; vidros ainda não tem dados.
    if (tipo === "vidro") return [];
    const semTipo = await supabase
      .from(TABELA_GRUPOS)
      .select(SELECT_GRUPOS)
      .order("criado_em", { ascending: false });
    if (semTipo.error) throw semTipo.error;
    dados = semTipo.data;
  }

  return (dados || []).map(({ modelos, ...grupo }) => ({
    ...grupo,
    tipo: tipoDoGrupo(grupo),
    modelos: modelos || [],
  }));
}

/** Verifica se o usuário logado é admin do MecApp (user_roles.role = 'admin'), mesmo mecanismo das telas /admin/*. */
export function useIsAdminMecApp() {
  return useQuery({
    queryKey: ["is-admin-mecapp"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (error) {
        console.error("Erro ao verificar admin:", error);
        return false;
      }

      return !!data;
    },
  });
}

/**
 * Busca pública (películas ou vidros): acessível a qualquer usuário autenticado
 * do MecApp (leitura via RLS). Compatíveis de um modelo: encontrarCompativeis.
 */
export function useCompatibilidadePelicula(tipo: TipoCompatibilidade = "pelicula") {
  return useQuery({
    queryKey: ["compatibilidade-pelicula", tipo],
    queryFn: () => withRetry(() => carregarGruposComModelos(tipo), "useCompatibilidadePelicula"),
  });
}

/** CRUD administrativo do tipo escolhido: escrita bloqueada pela RLS para quem não for admin do MecApp. */
export function useCompatibilidadePeliculaAdmin(tipo: TipoCompatibilidade = "pelicula") {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ["compatibilidade-pelicula-admin", tipo],
    queryFn: () => withRetry(() => carregarGruposComModelos(tipo), "useCompatibilidadePeliculaAdmin"),
  });

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ["compatibilidade-pelicula-admin"] });
    queryClient.invalidateQueries({ queryKey: ["compatibilidade-pelicula"] });
  };

  const criarGrupo = useMutation({
    mutationFn: async (nome: string): Promise<GrupoCompatibilidadePelicula> => {
      const { data: { user } } = await supabase.auth.getUser();

      const novo = { nome: nome.trim(), criado_por: user?.id ?? null };

      const comTipo = await supabase.from(TABELA_GRUPOS).insert({ ...novo, tipo }).select().single();
      if (!comTipo.error) return { ...comTipo.data, tipo: tipoDoGrupo(comTipo.data) };
      if (!ehErroColunaTipoAusente(comTipo.error)) throw comTipo.error;
      if (tipo === "vidro") throw new Error(MSG_SEM_COLUNA_TIPO);

      // Antes da migration: grupo de película sem a coluna (o DEFAULT marca 'pelicula' depois).
      const semTipo = await supabase.from(TABELA_GRUPOS).insert(novo).select().single();
      if (semTipo.error) throw semTipo.error;
      return { ...semTipo.data, tipo: "pelicula" };
    },
    onSuccess: () => {
      invalidar();
      toast({ title: "Grupo criado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar grupo", description: error.message, variant: "destructive" });
    },
  });

  const renomearGrupo = useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const { error } = await supabase
        .from("grupos_compatibilidade_pelicula")
        .update({ nome: nome.trim() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidar();
      toast({ title: "Grupo atualizado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar grupo", description: error.message, variant: "destructive" });
    },
  });

  const excluirGrupo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("grupos_compatibilidade_pelicula")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidar();
      toast({ title: "Grupo excluído com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir grupo", description: error.message, variant: "destructive" });
    },
  });

  const adicionarModelo = useMutation({
    mutationFn: async ({ grupoId, marca, modelo }: { grupoId: string; marca: string; modelo: string }) => {
      const { error } = await supabase
        .from("grupo_compatibilidade_modelos")
        .insert({ grupo_id: grupoId, marca, modelo });

      if (error) throw error;
    },
    onSuccess: () => {
      invalidar();
    },
    onError: (error: Error & { code?: string }) => {
      const mensagem = error.code === "23505"
        ? "Esse modelo já está neste grupo."
        : error.message;
      toast({ title: "Erro ao adicionar modelo", description: mensagem, variant: "destructive" });
    },
  });

  const removerModelo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("grupo_compatibilidade_modelos")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidar();
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao remover modelo", description: error.message, variant: "destructive" });
    },
  });

  return {
    grupos: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    criarGrupo,
    renomearGrupo,
    excluirGrupo,
    adicionarModelo,
    removerModelo,
  };
}
