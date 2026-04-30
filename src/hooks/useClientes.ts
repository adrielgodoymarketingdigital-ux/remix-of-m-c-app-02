import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Cliente, FormularioCliente } from "@/types/cliente";
import { useToast } from "@/hooks/use-toast";
import { useEventTracking } from "./useEventTracking";
import { useFuncionarioPermissoes } from "./useFuncionarioPermissoes";
import { useConfetti } from "./useConfetti";
import { withRetry, classifyError, shouldSuppressToast } from "@/lib/supabase-retry";

interface UseClientesOptions {
  /** Se true, evita navegação automática e efeitos visuais após criar cliente (útil para PDV) */
  modoSilencioso?: boolean;
}

export function useClientes(options: UseClientesOptions = {}) {
  const { modoSilencioso = false } = options;
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { trackClienteCadastrado } = useEventTracking();
  const { disparar: dispararConfetti } = useConfetti();
  const navigate = useNavigate();
  const { isFuncionario, lojaUserId, podeSincronizarClientes } = useFuncionarioPermissoes();

  const carregarClientes = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setLoading(false);
        return;
      }

      // Se é funcionário com permissão de sincronizar clientes, busca pelo ID do dono
      const targetUserId = (isFuncionario && podeSincronizarClientes && lojaUserId) 
        ? lojaUserId 
        : user.id;

      const data = await withRetry(async () => {
        const { data, error } = await supabase
          .from("clientes")
          .select("*")
          .eq("user_id", targetUserId)
          .is("deleted_at", null)
          .order("nome");
        if (error) throw error;
        return data;
      }, 'useClientes.carregarClientes');

      setClientes((data || []) as Cliente[]);
    } catch (error: unknown) {
      if (!shouldSuppressToast(error)) {
        const { userMessage } = classifyError(error);
        toast({
          title: "Erro ao carregar clientes",
          description: userMessage,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [toast, isFuncionario, lojaUserId, podeSincronizarClientes]);

  const criarCliente = async (dados: FormularioCliente): Promise<Cliente | null> => {
    try {
      // Validar campos obrigatórios
      if (!dados.nome || dados.nome.trim().length < 1) {
        toast({
          title: "Erro de validação",
          description: "Nome do cliente é obrigatório.",
          variant: "destructive",
        });
        return null;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Sessão expirada",
          description: "Por favor, faça login novamente.",
          variant: "destructive",
        });
        return null;
      }
      
      const user = session.user;

      // Sanitizar campos opcionais: strings vazias viram null (evita erro de tipo date)
      // Se é funcionário, usa o ID do dono da loja
      const targetUserId = (isFuncionario && podeSincronizarClientes && lojaUserId) ? lojaUserId : user.id;

      const dadosSanitizados = {
        ...dados,
        user_id: targetUserId,
        cpf: dados.cpf?.trim() || null,
        cnpj: dados.cnpj?.trim() || null,
        telefone: dados.telefone?.trim() || null,
        endereco: dados.endereco?.trim() || null,
        data_nascimento: dados.data_nascimento?.trim() || null,
      };

      const { data, error } = await supabase.from("clientes").insert(dadosSanitizados).select().single();

      if (error) throw error;

      toast({
        title: "Cliente cadastrado",
        description: "O cliente foi cadastrado com sucesso.",
      });

      // Tracking de evento e atualização do onboarding
      if (data?.id) {
        trackClienteCadastrado(data.id);
        
        // Só executa onboarding/confetti/navegação se não estiver em modo silencioso
        if (!modoSilencioso) {
          // Atualizar progresso do onboarding
          const { data: onboardingData } = await supabase
            .from('user_onboarding')
            .select('step_dispositivo_cadastrado')
            .eq('user_id', user.id)
            .maybeSingle();
          
          await supabase.rpc('update_onboarding_step', {
            _user_id: user.id,
            _step: 'cliente_cadastrado'
          });

          // Disparar confetti de celebração
          dispararConfetti('celebracao');

          // Navegar para próximo passo se ainda não completou dispositivo
          if (!onboardingData?.step_dispositivo_cadastrado) {
            setTimeout(() => navigate('/dispositivos'), 800);
          }
        }
      }

      await carregarClientes();
      return data as Cliente;
    } catch (error: any) {
      console.error("Erro ao cadastrar cliente:", error);
      
      let mensagemErro = "Não foi possível cadastrar o cliente.";
      if (error?.message?.includes("JWT")) {
        mensagemErro = "Sua sessão expirou. Por favor, faça login novamente.";
      } else if (error?.message) {
        mensagemErro = error.message;
      }
      
      toast({
        title: "Erro ao cadastrar cliente",
        description: mensagemErro,
        variant: "destructive",
      });
      return null;
    }
  };

  const atualizarCliente = async (id: string, dados: FormularioCliente) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      // Usar ID do dono se funcionário tem permissão de sincronizar clientes
      const targetUserId = (isFuncionario && podeSincronizarClientes && lojaUserId) ? lojaUserId : user.id;

      const dadosSanitizados = {
        ...dados,
        cpf: dados.cpf?.trim() || null,
        cnpj: dados.cnpj?.trim() || null,
        telefone: dados.telefone?.trim() || null,
        endereco: dados.endereco?.trim() || null,
        data_nascimento: dados.data_nascimento?.trim() || null,
      };

      const { error } = await supabase
        .from("clientes")
        .update(dadosSanitizados)
        .eq("id", id)
        .eq("user_id", targetUserId);

      if (error) throw error;

      toast({
        title: "Cliente atualizado",
        description: "O cliente foi atualizado com sucesso.",
      });

      await carregarClientes();
      return true;
    } catch (error) {
      console.error("Erro ao atualizar cliente:", error);
      toast({
        title: "Erro ao atualizar cliente",
        description: "Não foi possível atualizar o cliente.",
        variant: "destructive",
      });
      return false;
    }
  };

  const excluirCliente = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      // Usar ID do dono se funcionário tem permissão de sincronizar clientes
      const targetUserId = (isFuncionario && podeSincronizarClientes && lojaUserId) ? lojaUserId : user.id;

      // Verificar se existem ordens, vendas ou orçamentos associados
      const [{ data: ordens }, { data: vendas }, { data: orcamentos }] = await Promise.all([
        supabase
          .from("ordens_servico")
          .select("id")
          .eq("cliente_id", id)
          .eq("user_id", targetUserId)
          .is("deleted_at", null)
          .limit(1),
        supabase
          .from("vendas")
          .select("id")
          .eq("cliente_id", id)
          .eq("user_id", targetUserId)
          .is("deleted_at", null)
          .limit(1),
        supabase
          .from("orcamentos")
          .select("id")
          .eq("cliente_id", id)
          .eq("user_id", targetUserId)
          .is("deleted_at", null)
          .limit(1),
      ]);

      if ((ordens && ordens.length > 0) || (vendas && vendas.length > 0) || (orcamentos && orcamentos.length > 0)) {
        const partes: string[] = [];
        if (ordens && ordens.length > 0) partes.push("ordens de serviço");
        if (vendas && vendas.length > 0) partes.push("vendas");
        if (orcamentos && orcamentos.length > 0) partes.push("orçamentos");

        const mensagem = `Este cliente possui ${partes.join(", ")} associados. Ao excluir, o vínculo será removido mas os registros serão mantidos.`;

        toast({
          title: "Atenção",
          description: mensagem,
        });
      }

      const { error } = await supabase
        .from("clientes")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", targetUserId);

      if (error) throw error;

      toast({
        title: "Cliente excluído",
        description: "O cliente foi excluído com sucesso.",
      });

      await carregarClientes();
      return true;
    } catch (error: any) {
      console.error("Erro ao excluir cliente:", error);
      
      let mensagemErro = "Não foi possível excluir o cliente.";
      
      if (error?.code === "23503") {
        mensagemErro = "Este cliente não pode ser excluído pois está associado a outros registros.";
      } else if (error?.message?.includes("JWT")) {
        mensagemErro = "Sua sessão expirou. Por favor, faça login novamente.";
      } else if (error?.message) {
        mensagemErro = error.message;
      }
      
      toast({
        title: "Erro ao excluir cliente",
        description: mensagemErro,
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    carregarClientes();
  }, [carregarClientes]);

  const importarEmLote = async (lista: FormularioCliente[]): Promise<{ inseridos: number; erros: number }> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");

      const targetUserId = (isFuncionario && podeSincronizarClientes && lojaUserId)
        ? lojaUserId
        : session.user.id;

      let inseridos = 0;
      let erros = 0;

      // Inserir em lotes de 50
      for (let i = 0; i < lista.length; i += 50) {
        const lote = lista.slice(i, i + 50).map(c => ({
          nome: c.nome,
          cpf: c.cpf?.trim() || null,
          cnpj: c.cnpj?.trim() || null,
          telefone: c.telefone?.trim() || null,
          endereco: c.endereco?.trim() || null,
          data_nascimento: c.data_nascimento?.trim() || null,
          user_id: targetUserId,
        }));

        const { data, error } = await supabase.from("clientes").insert(lote).select("id");
        if (error) {
          console.error("Erro ao importar lote de clientes:", error);
          erros += lote.length;
        } else {
          inseridos += data?.length || 0;
        }
      }

      await carregarClientes();
      return { inseridos, erros };
    } catch (error: any) {
      console.error("Erro na importação em lote:", error);
      throw error;
    }
  };

  return {
    clientes,
    loading,
    criarCliente,
    atualizarCliente,
    excluirCliente,
    importarEmLote,
    refetch: carregarClientes,
  };
}
