import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Servico } from "@/types/servico";
import { useFuncionarioPermissoes } from "./useFuncionarioPermissoes";
import { withRetry, shouldSuppressToast } from "@/lib/supabase-retry";
import { useEmpresaFiltro } from "./useResolvedUserId";

export const useServicos = () => {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const { lojaUserId, podeSincronizarServicos, isFuncionario, carregando: carregandoPermissoes } = useFuncionarioPermissoes();
  const empresaFiltro = useEmpresaFiltro();

  const carregarServicos = useCallback(async () => {
    // Aguardar permissões carregarem para usar o user_id correto
    if (carregandoPermissoes) return;
    try {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) { setLoading(false); return; }

      // Usar ID do dono se funcionário tem permissão de sincronizar serviços
      const userId = (isFuncionario && podeSincronizarServicos && lojaUserId) ? lojaUserId : user.id;

      const data = await withRetry(async () => {
        let query = supabase
          .from("servicos")
          .select(`
            *,
            pecas:peca_id (
              id,
              nome
            )
          `)
          .eq("user_id", userId)
          .order("nome");
        if (empresaFiltro) query = query.or(`empresa_id.eq.${empresaFiltro},empresa_id.is.null`);
        const { data, error } = await query;
        if (error) throw error;
        return data;
      }, 'useServicos.carregarServicos');
      
      // Transformar dados para incluir peca_nome
      const servicosComPecas = (data || []).map((servico: any) => ({
        ...servico,
        peca_nome: servico.pecas?.nome || null,
        pecas: undefined,
      }));
      
      const servicosOrdenados = servicosComPecas.sort((a, b) =>
        a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" })
      );
      
      setServicos(servicosOrdenados);
    } catch (error: unknown) {
      if (!shouldSuppressToast(error)) {
        toast.error("Erro ao carregar serviços. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  }, [lojaUserId, podeSincronizarServicos, isFuncionario, carregandoPermissoes, empresaFiltro]);

  const criarServico = async (dados: Omit<Servico, "id" | "created_at">) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Remove lucro do insert - é uma coluna GENERATED ALWAYS
      const { lucro, ...dadosSemLucro } = dados;
      
      // Usar ID do dono se funcionário tem permissão
      const userId = (isFuncionario && podeSincronizarServicos && lojaUserId) ? lojaUserId : user.id;

      const dadosCompletos = {
        ...dadosSemLucro,
        quantidade: dados.quantidade ?? 0,
        user_id: userId
      };

      const { data, error } = await supabase
        .from("servicos")
        .insert([dadosCompletos])
        .select()
        .single();

      if (error) throw error;
      
      toast.success("Serviço criado com sucesso!");
      await carregarServicos();
      return data;
    } catch (error: any) {
      console.error("Erro ao criar serviço:", error);
      
      const mensagem = error?.message?.includes('quantidade') 
        ? "Erro: campo quantidade é obrigatório"
        : "Erro ao criar serviço";
      
      toast.error(mensagem);
      return null;
    }
  };

  const atualizarServico = async (id: string, dados: Omit<Servico, "id" | "created_at">) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Remove lucro do update - é uma coluna GENERATED ALWAYS
      const { lucro, ...dadosSemLucro } = dados;

      // Usar ID do dono se funcionário tem permissão
      const userId = (isFuncionario && podeSincronizarServicos && lojaUserId) ? lojaUserId : user.id;

      const { data, error } = await supabase
        .from("servicos")
        .update(dadosSemLucro)
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) throw error;
      
      toast.success("Serviço atualizado com sucesso!");
      await carregarServicos();
      return data;
    } catch (error) {
      console.error("Erro ao atualizar serviço:", error);
      toast.error("Erro ao atualizar serviço");
      return null;
    }
  };

  const excluirServico = async (id: string) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Usar ID do dono se funcionário tem permissão
      const userId = (isFuncionario && podeSincronizarServicos && lojaUserId) ? lojaUserId : user.id;

      // Proteção estrutural (vale para TODAS as contas): excluir fisicamente um
      // serviço do catálogo que já foi usado em alguma OS quebra qualquer
      // re-salvamento dessa OS — a FK ordens_servico.servico_id está
      // ON DELETE SET NULL, mas o snapshot em avarias.servicos_realizados
      // mantém o id antigo e o wizard tenta regravá-lo, violando a FK.
      // Bloqueamos a exclusão enquanto houver uso, na coluna servico_id OU
      // dentro do JSON avarias.servicos_realizados.
      const [porColuna, porJson] = await Promise.all([
        supabase
          .from("ordens_servico")
          .select("id")
          .eq("user_id", userId)
          .eq("servico_id", id),
        supabase
          .from("ordens_servico")
          .select("id")
          .eq("user_id", userId)
          .contains("avarias", { servicos_realizados: [{ id }] }),
      ]);

      if (porColuna.error) throw porColuna.error;
      if (porJson.error) throw porJson.error;

      const osComUso = new Set<string>([
        ...(porColuna.data || []).map((o: { id: string }) => o.id),
        ...(porJson.data || []).map((o: { id: string }) => o.id),
      ]);

      if (osComUso.size > 0) {
        const qtd = osComUso.size;
        toast.error("Não é possível excluir este serviço", {
          description: `Este serviço está sendo usado em ${qtd} ${qtd === 1 ? "ordem de serviço" : "ordens de serviço"} e não pode ser excluído. Remova-o dessas OS ou mantenha-o no catálogo.`,
        });
        return;
      }

      const { error } = await supabase
        .from("servicos")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (error) {
        // Rede de segurança caso a exclusão parta de outra tela sem a
        // verificação acima (23503 = foreign_key_violation).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const code = (error as any).code;
        if (code === "23503" || error.message?.toLowerCase().includes("foreign key")) {
          toast.error("Não é possível excluir este serviço", {
            description: "Ele está vinculado a ordens de serviço existentes. Remova o vínculo nessas OS ou mantenha o serviço no catálogo.",
          });
          return;
        }
        throw error;
      }

      toast.success("Serviço excluído com sucesso!");
      await carregarServicos();
    } catch (error) {
      console.error("Erro ao excluir serviço:", error);
      toast.error("Erro ao excluir serviço");
    }
  };

  useEffect(() => {
    carregarServicos();
  }, [carregarServicos]);

  // Realtime: recarrega quando outro usuário (ex: funcionário) alterar serviços
  useEffect(() => {
    if (carregandoPermissoes) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;

      // Dono assiste o próprio ID; funcionário assiste o ID do dono (lojaUserId)
      const watchedUserId = (isFuncionario && podeSincronizarServicos && lojaUserId)
        ? lojaUserId
        : session.user.id;

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      channelRef.current = supabase
        .channel(`servicos_changes_${watchedUserId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'servicos', filter: `user_id=eq.${watchedUserId}` }, () => { carregarServicos(); })
        .subscribe();
    });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [lojaUserId, isFuncionario, podeSincronizarServicos, carregandoPermissoes, carregarServicos]);

  return {
    servicos,
    loading,
    carregarServicos,
    criarServico,
    atualizarServico,
    excluirServico,
  };
};
