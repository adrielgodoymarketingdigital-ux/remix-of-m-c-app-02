import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { withRetry } from "@/lib/supabase-retry";
import {
  GrupoCompatibilidadeComModelos,
  GrupoCompatibilidadePelicula,
} from "@/types/compatibilidade-pelicula";

async function carregarGruposComModelos(): Promise<GrupoCompatibilidadeComModelos[]> {
  const [{ data: grupos, error: errGrupos }, { data: modelos, error: errModelos }] = await Promise.all([
    supabase
      .from("grupos_compatibilidade_pelicula")
      .select("*")
      .order("criado_em", { ascending: false }),
    supabase
      .from("grupo_compatibilidade_modelos")
      .select("*"),
  ]);

  if (errGrupos) throw errGrupos;
  if (errModelos) throw errModelos;

  return (grupos || []).map((grupo) => ({
    ...grupo,
    modelos: (modelos || []).filter((m) => m.grupo_id === grupo.id),
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

/** Busca pública: acessível a qualquer usuário autenticado do MecApp (leitura via RLS). */
export function useCompatibilidadePelicula() {
  return useQuery({
    queryKey: ["compatibilidade-pelicula"],
    queryFn: () => withRetry(carregarGruposComModelos, "useCompatibilidadePelicula"),
  });
}

/** Retorna o grupo (com todos os modelos) ao qual marca+modelo pertence, ou undefined se não cadastrado. */
export function encontrarGrupoDoModelo(
  grupos: GrupoCompatibilidadeComModelos[],
  marca: string,
  modelo: string,
): GrupoCompatibilidadeComModelos | undefined {
  return grupos.find((g) => g.modelos.some((m) => m.marca === marca && m.modelo === modelo));
}

/** CRUD administrativo: escrita bloqueada pela RLS para quem não for admin do MecApp. */
export function useCompatibilidadePeliculaAdmin() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ["compatibilidade-pelicula-admin"],
    queryFn: () => withRetry(carregarGruposComModelos, "useCompatibilidadePeliculaAdmin"),
  });

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ["compatibilidade-pelicula-admin"] });
    queryClient.invalidateQueries({ queryKey: ["compatibilidade-pelicula"] });
  };

  const criarGrupo = useMutation({
    mutationFn: async (nome: string): Promise<GrupoCompatibilidadePelicula> => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("grupos_compatibilidade_pelicula")
        .insert({ nome: nome.trim(), criado_por: user?.id ?? null })
        .select()
        .single();

      if (error) throw error;
      return data;
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
