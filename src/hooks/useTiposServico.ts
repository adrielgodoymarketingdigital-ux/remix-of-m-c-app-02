import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useFuncionarioPermissoes } from "./useFuncionarioPermissoes";
import { useEmpresaFiltro } from "./useResolvedUserId";
import { normalizarNomeParaComparacao } from "@/lib/ordemServico/comissaoPorTipoServico";

export interface TipoServico {
  id: string;
  user_id: string;
  nome: string;
  ativo: boolean;
  created_at: string;
}

/** Uso de um Tipo de Serviço — impede exclusão física direta. */
export interface UsoTipoServico {
  servicos: number;
  ordensServico: number;
  emUso: boolean;
}

/** Grupo de Tipos com nome equivalente (normalizado) — candidato a mesclagem. */
export interface GrupoTiposSimilares {
  chave: string;
  tipos: TipoServico[];
}

export function useTiposServico() {
  const [tiposServico, setTiposServico] = useState<TipoServico[]>([]);
  const [contagens, setContagens] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const { lojaUserId, isFuncionario, carregando: carregandoPermissoes } = useFuncionarioPermissoes();
  const empresaFiltro = useEmpresaFiltro();

  const resolverUserId = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    return (isFuncionario && lojaUserId) ? lojaUserId : user.id;
  }, [isFuncionario, lojaUserId]);

  const carregar = useCallback(async () => {
    if (carregandoPermissoes) return;
    try {
      setLoading(true);
      const userId = await resolverUserId();
      if (!userId) return;

      let query = supabase
        .from("tipos_servico")
        .select("*")
        .eq("user_id", userId)
        .order("nome");
      if (empresaFiltro) query = query.eq("empresa_id", empresaFiltro);
      const { data, error } = await query;

      if (error) throw error;
      const tipos = (data || []) as TipoServico[];
      setTiposServico(tipos);

      // Contador "quantos serviços do catálogo estão vinculados a cada tipo".
      // Feito client-side (o supabase-js não agrupa) — o catálogo é pequeno.
      let servicosQuery = supabase
        .from("servicos")
        .select("tipo_servico_id")
        .eq("user_id", userId)
        .not("tipo_servico_id", "is", null);
      if (empresaFiltro) servicosQuery = servicosQuery.or(`empresa_id.eq.${empresaFiltro},empresa_id.is.null`);
      const { data: vinculos } = await servicosQuery;
      const cont: Record<string, number> = {};
      (vinculos || []).forEach((v: { tipo_servico_id: string | null }) => {
        if (v.tipo_servico_id) cont[v.tipo_servico_id] = (cont[v.tipo_servico_id] || 0) + 1;
      });
      setContagens(cont);
    } catch (error) {
      console.error("Erro ao carregar tipos de serviço:", error);
      toast.error("Erro ao carregar tipos de serviço");
    } finally {
      setLoading(false);
    }
  }, [carregandoPermissoes, empresaFiltro, resolverUserId]);

  const criar = async (nome: string) => {
    try {
      const userId = await resolverUserId();
      if (!userId) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("tipos_servico")
        // empresa_id espelha o filtro de leitura (useEmpresaFiltro) para
        // leitura e escrita ficarem consistentes por construção.
        .insert({ nome, user_id: userId, empresa_id: empresaFiltro ?? null })
        .select()
        .single();

      if (error) throw error;
      toast.success("Tipo de serviço criado!");
      await carregar();
      return data as TipoServico;
    } catch (error) {
      console.error("Erro ao criar tipo de serviço:", error);
      toast.error("Erro ao criar tipo de serviço");
      return null;
    }
  };

  const atualizar = async (id: string, nome: string) => {
    try {
      const { error } = await supabase
        .from("tipos_servico")
        .update({ nome })
        .eq("id", id);

      if (error) throw error;
      toast.success("Tipo de serviço atualizado!");
      await carregar();
    } catch (error) {
      console.error("Erro ao atualizar tipo de serviço:", error);
      toast.error("Erro ao atualizar tipo de serviço");
    }
  };

  /**
   * Uso de um Tipo de Serviço: quantos serviços de catálogo o referenciam
   * (servicos.tipo_servico_id) e quantas OS o usam (ordens_servico.tipo_servico_id).
   * Enquanto houver uso, a exclusão física é bloqueada — o vínculo tem que ser
   * transferido (mesclagem) ou removido antes.
   */
  const verificarUso = useCallback(async (id: string): Promise<UsoTipoServico> => {
    const [{ count: servicosCount }, { count: osCount }] = await Promise.all([
      supabase.from("servicos").select("id", { count: "exact", head: true }).eq("tipo_servico_id", id),
      supabase.from("ordens_servico").select("id", { count: "exact", head: true }).eq("tipo_servico_id", id),
    ]);
    const servicos = servicosCount || 0;
    const ordensServico = osCount || 0;
    return { servicos, ordensServico, emUso: servicos > 0 || ordensServico > 0 };
  }, []);

  const excluir = async (id: string) => {
    try {
      // Proteção estrutural (mesma ideia de servicos/ordens_servico): não apagar
      // um Tipo que ainda está vinculado a serviços ou OS. Use a mesclagem para
      // transferir os vínculos antes.
      const uso = await verificarUso(id);
      if (uso.emUso) {
        const partes: string[] = [];
        if (uso.servicos > 0) partes.push(`${uso.servicos} serviço(s) do catálogo`);
        if (uso.ordensServico > 0) partes.push(`${uso.ordensServico} ordem(ns) de serviço`);
        toast.error("Não é possível excluir este tipo de serviço", {
          description: `Está vinculado a ${partes.join(" e ")}. Use "Mesclar tipos duplicados" para transferir os vínculos ou desvincule antes.`,
        });
        return;
      }

      const { error } = await supabase
        .from("tipos_servico")
        .delete()
        .eq("id", id);

      if (error) {
        if (error.code === "23503") {
          toast.error("Este tipo de serviço está vinculado a registros existentes e não pode ser excluído.");
          return;
        }
        throw error;
      }
      toast.success("Tipo de serviço excluído!");
      await carregar();
    } catch (error) {
      console.error("Erro ao excluir tipo de serviço:", error);
      toast.error("Erro ao excluir tipo de serviço");
    }
  };

  /**
   * Agrupa Tipos com nome equivalente após normalização (minúsculas, sem
   * espaços nas pontas, espaços internos colapsados). Só retorna grupos com 2+
   * itens — cada um é candidato a mesclagem.
   */
  const detectarGruposSimilares = useCallback((): GrupoTiposSimilares[] => {
    const porChave = new Map<string, TipoServico[]>();
    for (const t of tiposServico) {
      const chave = normalizarNomeParaComparacao(t.nome);
      if (!chave) continue;
      const lista = porChave.get(chave) || [];
      lista.push(t);
      porChave.set(chave, lista);
    }
    return [...porChave.entries()]
      .filter(([, lista]) => lista.length >= 2)
      .map(([chave, lista]) => ({
        chave,
        tipos: [...lista].sort((a, b) => a.created_at.localeCompare(b.created_at)),
      }))
      .sort((a, b) => a.chave.localeCompare(b.chave));
  }, [tiposServico]);

  /**
   * Mescla `duplicadosIds` no `sobreviventeId`: reaponta comissoes_tipo_servico,
   * servicos.tipo_servico_id e ordens_servico.tipo_servico_id para o
   * sobrevivente e então apaga os duplicados. IRREVERSÍVEL — a UI mostra um
   * preview e só chama aqui depois da confirmação.
   *
   * comissoes_tipo_servico tem UNIQUE(funcionario_id, tipo_servico_id): se um
   * funcionário já tem config para o sobrevivente, a config do duplicado é
   * DESCARTADA (não sobrescreve o sobrevivente); senão é reapontada.
   */
  const mesclarTipos = async (sobreviventeId: string, duplicadosIds: string[]): Promise<boolean> => {
    const dups = duplicadosIds.filter(id => id && id !== sobreviventeId);
    if (dups.length === 0) return false;
    try {
      // 1. comissoes_tipo_servico — respeitar o UNIQUE(func, tipo).
      const { data: configsSobrevivente } = await supabase
        .from("comissoes_tipo_servico")
        .select("funcionario_id")
        .eq("tipo_servico_id", sobreviventeId);
      const funcsComSobrevivente = new Set((configsSobrevivente || []).map((c: { funcionario_id: string }) => c.funcionario_id));

      const { data: configsDups } = await supabase
        .from("comissoes_tipo_servico")
        .select("id, funcionario_id")
        .in("tipo_servico_id", dups);

      const idsParaReapontar: string[] = [];
      const idsParaApagar: string[] = [];
      for (const c of (configsDups || []) as { id: string; funcionario_id: string }[]) {
        if (funcsComSobrevivente.has(c.funcionario_id)) {
          idsParaApagar.push(c.id);
        } else {
          idsParaReapontar.push(c.id);
          funcsComSobrevivente.add(c.funcionario_id); // evita colisão entre 2 duplicados do mesmo func
        }
      }
      if (idsParaApagar.length > 0) {
        const { error } = await supabase.from("comissoes_tipo_servico").delete().in("id", idsParaApagar);
        if (error) throw error;
      }
      if (idsParaReapontar.length > 0) {
        const { error } = await supabase
          .from("comissoes_tipo_servico")
          .update({ tipo_servico_id: sobreviventeId })
          .in("id", idsParaReapontar);
        if (error) throw error;
      }

      // 2. servicos.tipo_servico_id
      {
        const { error } = await supabase
          .from("servicos")
          .update({ tipo_servico_id: sobreviventeId })
          .in("tipo_servico_id", dups);
        if (error) throw error;
      }

      // 3. ordens_servico.tipo_servico_id (FK RESTRICT — tem que reapontar antes de apagar)
      {
        const { error } = await supabase
          .from("ordens_servico")
          .update({ tipo_servico_id: sobreviventeId })
          .in("tipo_servico_id", dups);
        if (error) throw error;
      }

      // 4. Apagar os duplicados
      {
        const { error } = await supabase.from("tipos_servico").delete().in("id", dups);
        if (error) throw error;
      }

      toast.success(
        dups.length === 1
          ? "Tipo duplicado mesclado."
          : `${dups.length} tipos duplicados mesclados.`,
      );
      await carregar();
      return true;
    } catch (error) {
      console.error("Erro ao mesclar tipos de serviço:", error);
      toast.error("Erro ao mesclar tipos de serviço. Nenhuma alteração parcial deve ter ficado — confira a lista.");
      await carregar();
      return false;
    }
  };

  useEffect(() => {
    carregar();
  }, [carregar]);

  return {
    tiposServico,
    contagens,
    loading,
    carregar,
    criar,
    atualizar,
    excluir,
    verificarUso,
    detectarGruposSimilares,
    mesclarTipos,
  };
}
