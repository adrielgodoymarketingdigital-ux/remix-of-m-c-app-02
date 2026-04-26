import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CompraDispositivo, FormularioCompraDispositivo } from "@/types/origem";

export function useComprasDispositivos() {
  const [compras, setCompras] = useState<CompraDispositivo[]>([]);
  const [loading, setLoading] = useState(true);

  const carregarCompras = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("compras_dispositivos")
        .select(`
          *,
          origem_pessoas (
            id,
            nome,
            cpf_cnpj,
            telefone
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
  }, []);

  const criarCompra = async (dados: FormularioCompraDispositivo) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const dadosInsercao = {
        ...dados,
        user_id: user.id,
        // Adiciona timestamps de assinatura se houver assinatura
        assinatura_vendedor_data: dados.assinatura_vendedor ? new Date().toISOString() : undefined,
        assinatura_cliente_data: dados.assinatura_cliente ? new Date().toISOString() : undefined,
      };

      const { data, error } = await supabase
        .from("compras_dispositivos")
        .insert([dadosInsercao])
        .select()
        .single();

      if (error) throw error;

      // Atualizar o dispositivo com o compra_id
      if (data && dados.dispositivo_id) {
        await supabase
          .from("dispositivos")
          .update({ compra_id: data.id })
          .eq("id", dados.dispositivo_id);
      }

      toast.success("Compra registrada com sucesso!");
      await carregarCompras();
      return data as CompraDispositivo;
    } catch (error: any) {
      console.error("Erro ao criar compra:", error);
      
      let mensagem = "Erro ao registrar compra";
      if (error?.message?.includes('check_origem')) {
        mensagem = "Selecione apenas uma origem (pessoa OU fornecedor)";
      }
      
      toast.error(mensagem);
      return null;
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
