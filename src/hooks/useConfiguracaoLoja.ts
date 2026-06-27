import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ConfiguracaoLoja } from "@/types/configuracao-loja";

export function validarConfiguracaoParaRecibos(config: ConfiguracaoLoja | null) {
  if (!config) return { valido: false, camposFaltando: ["Configuração não encontrada"], percentual: 0 };

  const camposObrigatorios = [
    { campo: config.nome_loja, nome: "Nome da loja" },
    { campo: config.razao_social, nome: "Razão social" },
    { campo: config.telefone, nome: "Telefone" },
    { campo: config.email, nome: "E-mail" },
    { campo: config.cep, nome: "CEP" },
    { campo: config.logradouro, nome: "Logradouro" },
    { campo: config.numero, nome: "Número" },
    { campo: config.bairro, nome: "Bairro" },
    { campo: config.cidade, nome: "Cidade" },
    { campo: config.estado, nome: "Estado" },
  ];

  const camposFaltando: string[] = [];
  let camposPreenchidos = 0;
  camposObrigatorios.forEach(({ campo, nome }) => {
    if (campo && campo.trim() !== "") {
      camposPreenchidos++;
    } else {
      camposFaltando.push(nome);
    }
  });

  const percentual = Math.round((camposPreenchidos / camposObrigatorios.length) * 100);

  return {
    valido: camposFaltando.length === 0,
    camposFaltando,
    percentual,
    camposPreenchidos,
    totalCampos: camposObrigatorios.length,
  };
}

/**
 * Busca pontual (fora de render) da configuração da loja para uma filial específica,
 * com fallback para a configuração da matriz. Útil em handlers de impressão que recebem
 * o registro (OS/venda/orçamento) e seu empresa_id apenas no momento do clique.
 */
export async function buscarConfiguracaoLojaPorEmpresa(
  empresaId?: string | null
): Promise<ConfiguracaoLoja | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  let targetUserId = user.id;
  const { data: funcData } = await supabase
    .from("loja_funcionarios")
    .select("loja_user_id")
    .eq("funcionario_user_id", user.id)
    .eq("ativo", true)
    .maybeSingle();
  if (funcData?.loja_user_id) {
    targetUserId = funcData.loja_user_id;
  }

  if (empresaId) {
    const { data: configFilial } = await supabase
      .from("configuracoes_loja")
      .select("*")
      .eq("user_id", targetUserId)
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (configFilial) return configFilial as unknown as ConfiguracaoLoja;
  }

  const { data: configMatriz } = await supabase
    .from("configuracoes_loja")
    .select("*")
    .eq("user_id", targetUserId)
    .is("empresa_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (configMatriz as unknown as ConfiguracaoLoja) ?? null;
}

/**
 * @param empresaId Quando informado, busca/cria/atualiza a configuração específica
 * dessa filial (empresa_id = empresaId). Se a filial ainda não tiver configuração
 * própria, cai de volta para a configuração da matriz (empresa_id IS NULL) apenas
 * para leitura, para que a impressão nunca fique sem dados. Quando omitido/null,
 * comportamento é o de sempre: configuração da matriz/conta principal.
 */
export function useConfiguracaoLoja(empresaId?: string | null) {
  const [config, setConfig] = useState<ConfiguracaoLoja | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    buscarConfiguracao();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  const criarConfiguracaoPadrao = async (userId: string, userEmail: string, targetEmpresaId: string | null) => {
    try {
      // Verificar se já existe configuração para evitar duplicatas
      let existenteQuery = supabase
        .from("configuracoes_loja")
        .select("id")
        .eq("user_id", userId);
      existenteQuery = targetEmpresaId
        ? existenteQuery.eq("empresa_id", targetEmpresaId)
        : existenteQuery.is("empresa_id", null);
      const { data: existente } = await existenteQuery.limit(1).maybeSingle();

      if (existente) {
        console.log("Configuração já existe, buscando dados...");
        await buscarConfiguracao();
        return true;
      }

      const { error } = await supabase
        .from("configuracoes_loja")
        .insert({
          user_id: userId,
          empresa_id: targetEmpresaId,
          nome_loja: "Minha Loja",
          razao_social: "",
          cnpj: "",
          endereco: "",
          telefone: "",
          email: userEmail,
        });

      if (error) {
        console.error("Erro ao criar configuração padrão:", error);
        return false;
      }

      await buscarConfiguracao();
      return true;
    } catch (error) {
      console.error("Erro ao criar configuração padrão:", error);
      return false;
    }
  };

  const buscarConfiguracao = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        console.error("Usuário não autenticado");
        setLoading(false);
        return;
      }

      // Resolver o user_id correto: funcionário → dono da loja, gerente → proprietário, dono → próprio id
      let targetUserId = user.id;

      // Verifica se é funcionário comum
      const { data: funcData } = await supabase
        .from("loja_funcionarios")
        .select("loja_user_id")
        .eq("funcionario_user_id", user.id)
        .eq("ativo", true)
        .maybeSingle();

      if (funcData?.loja_user_id) {
        targetUserId = funcData.loja_user_id;
      }
      // Gerente de filial usa config própria (user.id) — não herda config do proprietário

      if (empresaId) {
        const { data: configFilial, error: errorFilial } = await supabase
          .from("configuracoes_loja")
          .select("*")
          .eq("user_id", targetUserId)
          .eq("empresa_id", empresaId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (errorFilial) {
          console.error("Erro ao buscar configurações da filial:", errorFilial);
        } else if (configFilial) {
          setConfig(configFilial as unknown as ConfiguracaoLoja);
          setLoading(false);
          return;
        }

        // Filial sem configuração própria: usa a da matriz como fallback de leitura
        const { data: configMatriz, error: errorMatriz } = await supabase
          .from("configuracoes_loja")
          .select("*")
          .eq("user_id", targetUserId)
          .is("empresa_id", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (errorMatriz) {
          console.error("Erro ao buscar configurações da matriz:", errorMatriz);
        } else if (configMatriz) {
          setConfig(configMatriz as unknown as ConfiguracaoLoja);
        } else if (targetUserId === user.id) {
          await criarConfiguracaoPadrao(user.id, user.email || "", null);
        }
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("configuracoes_loja")
        .select("*")
        .eq("user_id", targetUserId)
        .is("empresa_id", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Erro ao buscar configurações:", error);
      } else if (!data) {
        // Só criar config padrão para o próprio usuário logado (não para o dono da loja quando é funcionário)
        if (targetUserId === user.id) {
          await criarConfiguracaoPadrao(user.id, user.email || "", null);
        }
      } else {
        setConfig(data as unknown as ConfiguracaoLoja);
      }
    } catch (error) {
      console.error("Erro ao buscar configurações:", error);
    } finally {
      setLoading(false);
    }
  };

  const atualizarConfiguracao = async (dados: Partial<ConfiguracaoLoja>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error("Usuário não autenticado");
        return false;
      }

      // Resolver o user_id correto: funcionário → dono da loja, dono → próprio id
      let targetUserId = user.id;
      const { data: funcData } = await supabase
        .from("loja_funcionarios")
        .select("loja_user_id")
        .eq("funcionario_user_id", user.id)
        .eq("ativo", true)
        .maybeSingle();
      if (funcData?.loja_user_id) {
        targetUserId = funcData.loja_user_id;
      }

      // Buscar configuração atual do proprietário correto (sempre da filial selecionada,
      // nunca a da matriz por fallback — editar sempre deve criar/gravar na filial certa)
      let configAtualQuery = supabase
        .from("configuracoes_loja")
        .select("*")
        .eq("user_id", targetUserId);
      configAtualQuery = empresaId
        ? configAtualQuery.eq("empresa_id", empresaId)
        : configAtualQuery.is("empresa_id", null);
      const { data: configAtual, error: errorBusca } = await configAtualQuery
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Se não existe, criar primeiro (apenas para o próprio usuário, ou para uma
      // filial do proprietário logado)
      if (errorBusca || !configAtual) {
        if (targetUserId !== user.id && !empresaId) {
          console.error("Configuração do proprietário não encontrada");
          return false;
        }
        console.log("Configuração não encontrada, criando...");
        const criado = await criarConfiguracaoPadrao(targetUserId, user.email || "", empresaId ?? null);
        if (!criado) {
          console.error("Erro ao criar configuração");
          return false;
        }
        // Buscar novamente após criar
        let novaConfigQuery = supabase
          .from("configuracoes_loja")
          .select("*")
          .eq("user_id", targetUserId);
        novaConfigQuery = empresaId
          ? novaConfigQuery.eq("empresa_id", empresaId)
          : novaConfigQuery.is("empresa_id", null);
        const { data: novaConfig, error: errorNova } = await novaConfigQuery
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (errorNova || !novaConfig) {
          console.error("Erro ao buscar configuração recém-criada:", errorNova);
          return false;
        }

        const { error: errorUpdate } = await supabase
          .from("configuracoes_loja")
          .update(dados as Record<string, unknown>)
          .eq("id", novaConfig.id);

        if (errorUpdate) {
          console.error("Erro ao atualizar nova configuração:", errorUpdate);
          return false;
        }
      } else {
        // Atualizar configuração existente
        const { error } = await supabase
          .from("configuracoes_loja")
          .update(dados as Record<string, unknown>)
          .eq("id", configAtual.id);

        if (error) {
          console.error("Erro ao atualizar configurações:", error);
          return false;
        }
      }

      await buscarConfiguracao();
      return true;
    } catch (error) {
      console.error("Erro ao atualizar configurações:", error);
      return false;
    }
  };

  const uploadLogo = async (arquivo: File): Promise<string | null> => {
    try {
      const fileExt = arquivo.name.split(".").pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("loja-logos")
        .upload(filePath, arquivo);

      if (uploadError) {
        console.error("Erro ao fazer upload:", uploadError);
        return null;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("loja-logos").getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      return null;
    }
  };

  const removerLogo = async (logoUrl: string) => {
    try {
      const fileName = logoUrl.split("/").pop();
      if (!fileName) return false;

      const { error } = await supabase.storage
        .from("loja-logos")
        .remove([fileName]);

      if (error) {
        console.error("Erro ao remover logo:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Erro ao remover logo:", error);
      return false;
    }
  };

  const validarDadosObrigatorios = () => {
    if (!config) return { valido: false, camposFaltando: ["Configuração não encontrada"] };

    const camposFaltando: string[] = [];
    if (!config.nome_loja) camposFaltando.push("Nome da loja");
    if (!config.razao_social) camposFaltando.push("Razão social");
    if (!config.cnpj) camposFaltando.push("CNPJ");
    if (!config.endereco) camposFaltando.push("Endereço");
    if (!config.telefone) camposFaltando.push("Telefone");

    return { valido: camposFaltando.length === 0, camposFaltando };
  };

  const validarParaRecibos = () => validarConfiguracaoParaRecibos(config);

  const formatarEnderecoCompleto = () => {
    if (!config) return "";

    const partes: string[] = [];
    
    if (config.logradouro) partes.push(config.logradouro);
    if (config.numero) partes.push(`nº ${config.numero}`);
    if (config.complemento) partes.push(config.complemento);
    if (config.bairro) partes.push(`- ${config.bairro}`);
    if (config.cidade && config.estado) partes.push(`- ${config.cidade}/${config.estado}`);
    if (config.cep) partes.push(`- CEP: ${config.cep}`);

    return partes.join(" ");
  };

  return {
    config,
    loading,
    refetch: buscarConfiguracao,
    atualizarConfiguracao,
    uploadLogo,
    removerLogo,
    validarDadosObrigatorios,
    validarParaRecibos,
    formatarEnderecoCompleto,
  };
}
