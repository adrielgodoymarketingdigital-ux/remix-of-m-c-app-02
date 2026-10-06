import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CompraDispositivo, FormularioCompraDispositivo } from "@/types/origem";
import { useEmpresaInfo } from "./useResolvedUserId";
import { filtroEmpresaCompras, montarDadosInsercaoCompra } from "@/lib/origem/comprasDispositivos";
import {
  ResultadoCompra,
  comLimiteDeTempo,
  montarMensagemErroCompra,
  tamanhoPayloadKB,
} from "@/lib/origem/fluxoCompra";

// Obter a sessão pode travar no Android/PWA (trava de sessão do supabase-js ao voltar do segundo plano).
const LIMITE_SESSAO_MS = 15_000;

export function useComprasDispositivos() {
  const [compras, setCompras] = useState<CompraDispositivo[]>([]);
  const [loading, setLoading] = useState(true);
  // Empresa ativa: a mesma usada no filtro da lista e gravada no insert.
  const { empresaId, isFilial } = useEmpresaInfo();

  const carregarCompras = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setLoading(false);
        return;
      }

      let query = supabase
        .from("compras_dispositivos")
        .select(`
          *,
          origem_pessoas (
            id,
            nome,
            cpf_cnpj,
            telefone,
            tipo
          ),
          fornecedores (
            nome
          ),
          dispositivos!compras_dispositivos_dispositivo_id_fkey (
            marca,
            modelo,
            imei
          )
        `)
        .eq("user_id", user.id)
        .order("data_compra", { ascending: false });
      // Matriz inclui as compras sem empresa_id (antes o insert não gravava e elas sumiam da lista).
      const filtro = filtroEmpresaCompras(empresaId, isFilial);
      if (filtro.tipo === "eq") query = query.eq("empresa_id", filtro.empresaId);
      else if (filtro.tipo === "eq_ou_nulo") query = query.or(filtro.expressaoOr);
      const { data, error } = await query;

      if (error) throw error;
      setCompras((data || []) as CompraDispositivo[]);
    } catch (error: any) {
      console.error("Erro ao carregar compras:", error);
      if (!error?.message?.includes("Auth") && !error?.message?.includes("JWT") && !error?.message?.includes("refresh_token")) {
        toast.error("Erro ao carregar compras");
      }
    } finally {
      setLoading(false);
    }
  }, [empresaId, isFilial]);

  /**
   * Grava a compra e devolve o resultado explícito: só { ok: true } fecha o
   * diálogo (ver deveFecharDialogo). Limite de tempo só na etapa sem escrita
   * (obter usuário) — depois do insert não há timeout, para não duplicar.
   */
  const criarCompra = async (dados: FormularioCompraDispositivo): Promise<ResultadoCompra<CompraDispositivo>> => {
    let etapa = "obter usuário";
    let payloadKB: number | null = null;
    try {
      const { data: { user } } = await comLimiteDeTempo(supabase.auth.getUser(), LIMITE_SESSAO_MS, "Obter sessão");
      if (!user) throw new Error("Usuário não autenticado");

      const dadosInsercao = montarDadosInsercaoCompra(dados, { userId: user.id, empresaId, agora: new Date() });
      payloadKB = tamanhoPayloadKB([dadosInsercao]);

      etapa = "criar compra";
      const { data, error } = await supabase
        .from("compras_dispositivos")
        .insert([dadosInsercao])
        .select()
        .single();

      if (error) throw error;

      // A compra já está gravada: falha aqui só fica registrada (não desfaz nem repete o insert).
      if (data && dados.dispositivo_id) {
        etapa = "vincular dispositivo";
        const { error: erroVinculo } = await supabase
          .from("dispositivos")
          .update({ compra_id: data.id })
          .eq("id", dados.dispositivo_id);
        if (erroVinculo) {
          console.error("[compra] etapa=vincular dispositivo", { codigo: erroVinculo.code, mensagem: erroVinculo.message, compraId: data.id });
        }
      }

      toast.success("Compra registrada com sucesso!");
      await carregarCompras();
      return { ok: true, compra: data as CompraDispositivo };
    } catch (error: unknown) {
      const { mensagem, detalhe } = montarMensagemErroCompra(error);
      const e = (error ?? {}) as { code?: string; message?: string; status?: number };
      console.error(`[compra] etapa=${etapa}`, {
        codigo: e.code ?? null,
        status: e.status ?? null,
        mensagem: e.message ?? String(error),
        payloadKB,
      });
      toast.error("Erro ao registrar compra", { description: detalhe ?? undefined });
      return { ok: false, mensagem, detalhe };
    }
  };

  const atualizarCompra = async (id: string, dados: Partial<FormularioCompraDispositivo>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("compras_dispositivos")
        .update(dados)
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;

      toast.success("Compra atualizada com sucesso!");
      await carregarCompras();
    } catch (error) {
      console.error("Erro ao atualizar compra:", error);
      toast.error("Erro ao atualizar compra");
    }
  };

  const excluirCompra = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("compras_dispositivos")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;

      toast.success("Compra excluída com sucesso!");
      await carregarCompras();
    } catch (error) {
      console.error("Erro ao excluir compra:", error);
      toast.error("Erro ao excluir compra");
    }
  };

  useEffect(() => {
    carregarCompras();
  }, [carregarCompras]);

  return {
    compras,
    loading,
    carregarCompras,
    criarCompra,
    atualizarCompra,
    excluirCompra,
  };
}
