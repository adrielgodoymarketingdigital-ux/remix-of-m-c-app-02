import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIdentidade } from "./useResolvedUserId";
import { normalizarNomeParaComparacao } from "@/lib/ordemServico/comissaoPorTipoServico";

export type NivelCatalogoCustom = "tipo" | "marca" | "modelo" | "cor";

export interface RegistroCatalogoCustom {
  id: string;
  user_id: string;
  empresa_id: string | null;
  nivel: NivelCatalogoCustom;
  nome: string;
  tipo_valor: string | null;
  marca_nome: string | null;
  created_at: string;
}

/** Uso de um registro — impede exclusão/edição livre enquanto houver vínculo. */
export interface UsoCatalogoCustom {
  ordensServico: number;
  /** Registros filhos (ex: Modelos/Cores de uma Marca) — só relevante pra nivel 'tipo'/'marca'. */
  filhos: number;
  emUso: boolean;
}

/** Grupo de registros com nome equivalente (mesmo nivel + mesmo escopo de pai) — candidato a mesclagem. */
export interface GrupoCatalogoCustomSimilares {
  chave: string;
  nivel: NivelCatalogoCustom;
  tipoValor: string | null;
  marcaNome: string | null;
  registros: RegistroCatalogoCustom[];
}

function colunaOSDoNivel(nivel: NivelCatalogoCustom): "dispositivo_tipo" | "dispositivo_marca" | "dispositivo_modelo" | "dispositivo_cor" {
  switch (nivel) {
    case "tipo": return "dispositivo_tipo";
    case "marca": return "dispositivo_marca";
    case "modelo": return "dispositivo_modelo";
    case "cor": return "dispositivo_cor";
  }
}

export function useCatalogoDispositivosCustom() {
  const { userId, empresaId, carregando: carregandoIdentidade } = useIdentidade();
  const [registros, setRegistros] = useState<RegistroCatalogoCustom[]>([]);
  const [loading, setLoading] = useState(false);

  const carregar = useCallback(async () => {
    if (carregandoIdentidade || !userId) return;
    setLoading(true);
    try {
      let query = supabase
        .from("catalogo_dispositivos_custom")
        .select("*")
        .eq("user_id", userId)
        .order("nome");
      if (empresaId) query = query.or(`empresa_id.eq.${empresaId},empresa_id.is.null`);
      const { data, error } = await query;
      if (error) throw error;
      setRegistros((data || []) as RegistroCatalogoCustom[]);
    } catch (error) {
      console.error("Erro ao carregar catálogo de dispositivos custom:", error);
    } finally {
      setLoading(false);
    }
  }, [carregandoIdentidade, userId, empresaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // ---- Getters de conveniência (mesclados no componente com o catálogo fixo) ----

  const getTiposCustom = useCallback(
    () => registros.filter((r) => r.nivel === "tipo"),
    [registros],
  );
  const getMarcasCustom = useCallback(
    (tipoValor: string) => registros.filter((r) => r.nivel === "marca" && r.tipo_valor === tipoValor),
    [registros],
  );
  const getModelosCustom = useCallback(
    (tipoValor: string, marcaNome: string) =>
      registros.filter((r) => r.nivel === "modelo" && r.tipo_valor === tipoValor && r.marca_nome === marcaNome),
    [registros],
  );
  const getCoresCustom = useCallback(
    (tipoValor: string, marcaNome: string) =>
      registros.filter((r) => r.nivel === "cor" && r.tipo_valor === tipoValor && r.marca_nome === marcaNome),
    [registros],
  );

  // ---- CRUD ----

  const criar = async (nivel: NivelCatalogoCustom, nome: string, opts?: { tipoValor?: string; marcaNome?: string }) => {
    if (!userId) throw new Error("Usuário não autenticado");
    try {
      const { data, error } = await supabase
        .from("catalogo_dispositivos_custom")
        .insert({
          user_id: userId,
          empresa_id: empresaId,
          nivel,
          nome,
          tipo_valor: opts?.tipoValor ?? null,
          marca_nome: opts?.marcaNome ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      toast.success("Cadastrado com sucesso!");
      await carregar();
      return data as RegistroCatalogoCustom;
    } catch (error) {
      console.error("Erro ao criar registro do catálogo custom:", error);
      toast.error("Erro ao cadastrar");
      return null;
    }
  };

  const atualizar = async (id: string, nome: string) => {
    try {
      const { error } = await supabase
        .from("catalogo_dispositivos_custom")
        .update({ nome })
        .eq("id", id);
      if (error) throw error;
      toast.success("Atualizado!");
      await carregar();
    } catch (error) {
      console.error("Erro ao atualizar registro do catálogo custom:", error);
      toast.error("Erro ao atualizar");
    }
  };

  /**
   * "Uso" combina duas coisas: OS existentes cujo dispositivo_* bate com o
   * nome (texto — não tem FK aqui) e, pra tipo/marca, registros filhos
   * custom ainda pendurados nele. Qualquer um dos dois bloqueia a exclusão.
   */
  const verificarUso = useCallback(async (registro: RegistroCatalogoCustom): Promise<UsoCatalogoCustom> => {
    if (!userId) return { ordensServico: 0, filhos: 0, emUso: false };

    let osQuery = supabase
      .from("ordens_servico")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq(colunaOSDoNivel(registro.nivel), registro.nome);
    if (registro.nivel !== "tipo") osQuery = osQuery.eq("dispositivo_tipo", registro.tipo_valor as string);
    if (registro.nivel === "modelo" || registro.nivel === "cor") osQuery = osQuery.eq("dispositivo_marca", registro.marca_nome as string);
    const { count: ordensServico } = await osQuery;

    let filhos = 0;
    if (registro.nivel === "tipo") {
      const { count } = await supabase
        .from("catalogo_dispositivos_custom")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("tipo_valor", registro.nome);
      filhos = count || 0;
    } else if (registro.nivel === "marca") {
      const { count } = await supabase
        .from("catalogo_dispositivos_custom")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("tipo_valor", registro.tipo_valor as string)
        .eq("marca_nome", registro.nome);
      filhos = count || 0;
    }

    const total = (ordensServico || 0) + filhos;
    return { ordensServico: ordensServico || 0, filhos, emUso: total > 0 };
  }, [userId]);

  const excluir = async (id: string) => {
    const registro = registros.find((r) => r.id === id);
    if (!registro) return;
    try {
      const uso = await verificarUso(registro);
      if (uso.emUso) {
        const partes: string[] = [];
        if (uso.filhos > 0) partes.push(`${uso.filhos} registro(s) cadastrados sob ele`);
        if (uso.ordensServico > 0) partes.push(`${uso.ordensServico} ordem(ns) de serviço`);
        toast.error("Não é possível excluir", {
          description: `Está vinculado a ${partes.join(" e ")}. Use "Mesclar duplicados" pra transferir, ou remova os filhos antes.`,
        });
        return;
      }
      const { error } = await supabase.from("catalogo_dispositivos_custom").delete().eq("id", id);
      if (error) throw error;
      toast.success("Excluído!");
      await carregar();
    } catch (error) {
      console.error("Erro ao excluir registro do catálogo custom:", error);
      toast.error("Erro ao excluir");
    }
  };

  /**
   * Agrupa registros do mesmo nivel + mesmo escopo de pai com nome
   * equivalente após normalização — cada grupo com 2+ é candidato a mesclagem.
   */
  const detectarGruposSimilares = useCallback(
    (nivel: NivelCatalogoCustom, escopo?: { tipoValor?: string; marcaNome?: string }): GrupoCatalogoCustomSimilares[] => {
      const doNivel = registros.filter((r) => {
        if (r.nivel !== nivel) return false;
        if (nivel !== "tipo" && r.tipo_valor !== escopo?.tipoValor) return false;
        if ((nivel === "modelo" || nivel === "cor") && r.marca_nome !== escopo?.marcaNome) return false;
        return true;
      });
      const porChave = new Map<string, RegistroCatalogoCustom[]>();
      for (const r of doNivel) {
        const chave = normalizarNomeParaComparacao(r.nome);
        if (!chave) continue;
        const lista = porChave.get(chave) || [];
        lista.push(r);
        porChave.set(chave, lista);
      }
      return [...porChave.entries()]
        .filter(([, lista]) => lista.length >= 2)
        .map(([chave, lista]) => ({
          chave,
          nivel,
          tipoValor: lista[0].tipo_valor,
          marcaNome: lista[0].marca_nome,
          registros: [...lista].sort((a, b) => a.created_at.localeCompare(b.created_at)),
        }));
    },
    [registros],
  );

  /**
   * Mescla `duplicadosIds` no `sobreviventeId`: reaponta as OS existentes
   * (texto, sem FK) e — pra tipo/marca — os registros filhos custom que
   * dependiam do nome apagado, depois apaga os duplicados. IRREVERSÍVEL — a
   * UI mostra preview de contagem e só chama isso após confirmação.
   */
  const mesclarRegistros = async (
    nivel: NivelCatalogoCustom,
    sobreviventeId: string,
    duplicadosIds: string[],
    escopo: { tipoValor?: string; marcaNome?: string },
  ): Promise<boolean> => {
    const dups = duplicadosIds.filter((id) => id && id !== sobreviventeId);
    if (dups.length === 0 || !userId) return false;

    const sobrevivente = registros.find((r) => r.id === sobreviventeId);
    const duplicados = registros.filter((r) => dups.includes(r.id));
    if (!sobrevivente || duplicados.length === 0) return false;
    const nomesDuplicados = duplicados.map((r) => r.nome);

    try {
      const colunaOS = colunaOSDoNivel(nivel);
      let updateOS = supabase
        .from("ordens_servico")
        .update({ [colunaOS]: sobrevivente.nome })
        .eq("user_id", userId)
        .in(colunaOS, nomesDuplicados);
      if (nivel !== "tipo") updateOS = updateOS.eq("dispositivo_tipo", escopo.tipoValor as string);
      if (nivel === "modelo" || nivel === "cor") updateOS = updateOS.eq("dispositivo_marca", escopo.marcaNome as string);
      const { error: errOS } = await updateOS;
      if (errOS) throw errOS;

      if (nivel === "tipo") {
        const { error } = await supabase
          .from("catalogo_dispositivos_custom")
          .update({ tipo_valor: sobrevivente.nome })
          .eq("user_id", userId)
          .in("tipo_valor", nomesDuplicados);
        if (error) throw error;
      } else if (nivel === "marca") {
        const { error } = await supabase
          .from("catalogo_dispositivos_custom")
          .update({ marca_nome: sobrevivente.nome })
          .eq("user_id", userId)
          .eq("tipo_valor", escopo.tipoValor as string)
          .in("marca_nome", nomesDuplicados);
        if (error) throw error;
      }

      const { error: errDelete } = await supabase.from("catalogo_dispositivos_custom").delete().in("id", dups);
      if (errDelete) throw errDelete;

      toast.success(dups.length === 1 ? "Registro duplicado mesclado." : `${dups.length} registros duplicados mesclados.`);
      await carregar();
      return true;
    } catch (error) {
      console.error("Erro ao mesclar registros do catálogo custom:", error);
      toast.error("Erro ao mesclar. Nenhuma alteração parcial deve ter ficado — confira a lista.");
      await carregar();
      return false;
    }
  };

  return {
    registros,
    loading,
    carregar,
    getTiposCustom,
    getMarcasCustom,
    getModelosCustom,
    getCoresCustom,
    criar,
    atualizar,
    excluir,
    verificarUso,
    detectarGruposSimilares,
    mesclarRegistros,
  };
}
