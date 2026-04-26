import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ConfiguracaoLoja } from "@/types/configuracao-loja";

export function useConfiguracaoLoja() {
  const [config, setConfig] = useState<ConfiguracaoLoja | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    buscarConfiguracao();
  }, []);

  const criarConfiguracaoPadrao = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return false;

      // Verificar se já existe configuração para evitar duplicatas
      const { data: existente } = await supabase
        .from("configuracoes_loja")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (existente) {
        console.log("Configuração já existe, buscando dados...");
        await buscarConfiguracao();
        return true;
      }

      const { error } = await supabase
        .from("configuracoes_loja")
        .insert({
          user_id: user.id,
          nome_loja: "Minha Loja",
          razao_social: "",
          cnpj: "",
          endereco: "",
          telefone: "",
          email: user.email || "",
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

      const { data, error } = await supabase
        .from("configuracoes_loja")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error("Erro ao buscar configurações:", error);
      } else if (!data) {
        // Nenhuma configuração encontrada, criar uma padrão
        await criarConfiguracaoPadrao();
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

      // Buscar configuração atual
      const { data: configAtual, error: errorBusca } = await supabase
        .from("configuracoes_loja")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      // Se não existe, criar primeiro
      if (errorBusca || !configAtual) {
        console.log("Configuração não encontrada, criando...");
        const criado = await criarConfiguracaoPadrao();
        if (!criado) {
          console.error("Erro ao criar configuração");
          return false;
        }
        // Buscar novamente após criar
        const { data: novaConfig, error: errorNova } = await supabase
          .from("configuracoes_loja")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        
        if (errorNova || !novaConfig) {
          console.error("Erro ao buscar configuração recém-criada:", errorNova);
          return false;
        }

        // Atualizar com os dados fornecidos
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

  const validarParaRecibos = () => {
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
  };

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
