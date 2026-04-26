import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type StatusUsuarioWhatsApp = 
  | "bloqueado" 
  | "trial_expirado" 
  | "assinatura_inativa" 
  | "pagante_ativo" 
  | "trial_ativo"
  | "free"
  | "free_ativo";

export interface MensagensWhatsAppAdmin {
  bloqueado: string;
  trial_expirado: string;
  assinatura_inativa: string;
  pagante_ativo: string;
  trial_ativo: string;
  free: string;
  free_ativo: string;
  [key: string]: string;
}

export const MENSAGENS_PADRAO_ADMIN: MensagensWhatsAppAdmin = {
  bloqueado: "Olá {{nome}}! Tudo bem? Vi que seu acesso ao MecApp está temporariamente bloqueado. Gostaria de ajudá-lo a regularizar sua situação e voltar a usar o sistema. Posso te ajudar com isso?",
  trial_expirado: "Olá {{nome}}! Tudo bem? Seu período de teste gratuito do MecApp chegou ao fim. Gostaria de apresentar nossos planos para você continuar usando todas as funcionalidades. Posso te ajudar a escolher o melhor plano?",
  assinatura_inativa: "Olá {{nome}}! Tudo bem? Notei que houve uma alteração em sua assinatura do MecApp. Gostaria de ajudá-lo a reativar seu acesso e continuar aproveitando o sistema. Como posso te ajudar?",
  pagante_ativo: "Olá {{nome}}! Tudo bem? Sou da equipe do MecApp e gostaria de saber como está sua experiência com o sistema. Precisa de algum suporte ou tem alguma sugestão?",
  trial_ativo: "Olá {{nome}}! Tudo bem? Percebi que você está usando o MecApp e gostaria de saber como está sendo sua experiência. Posso te ajudar em algo?",
  free: "Olá {{nome}}! Tudo bem? Vejo que você está no plano gratuito do MecApp. Gostaria de apresentar nossos planos pagos para você aproveitar todo o potencial do sistema. Posso te ajudar?",
  free_ativo: "Olá {{nome}}! Tudo bem? Você está usando o MecApp no plano gratuito. Que tal conhecer os benefícios dos nossos planos completos? Posso te mostrar o que cada um oferece!",
};

export function useAdminWhatsAppTemplates() {
  const [mensagens, setMensagens] = useState<MensagensWhatsAppAdmin>(MENSAGENS_PADRAO_ADMIN);
  const [isLoading, setIsLoading] = useState(true);
  const [templateId, setTemplateId] = useState<string | null>(null);

  const carregarTemplates = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("admin_whatsapp_templates" as any)
        .select("*")
        .limit(1)
        .single();

      if (error) {
        console.log("Erro ao carregar templates WhatsApp:", error);
        return;
      }

      if (data) {
        setTemplateId((data as any).id);
        const mensagensSalvas = (data as any).mensagens as MensagensWhatsAppAdmin;
        if (mensagensSalvas) {
          setMensagens({ ...MENSAGENS_PADRAO_ADMIN, ...mensagensSalvas });
        }
      }
    } catch (e) {
      console.log("Erro ao carregar templates:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarTemplates();
  }, [carregarTemplates]);

  const salvarTemplates = async (novasMensagens: MensagensWhatsAppAdmin) => {
    if (templateId) {
      const { error } = await supabase
        .from("admin_whatsapp_templates" as any)
        .update({ mensagens: novasMensagens as any, updated_at: new Date().toISOString() } as any)
        .eq("id", templateId);
      if (error) throw error;
    } else {
      // Cria o registro se ainda não existe
      const { data, error } = await supabase
        .from("admin_whatsapp_templates" as any)
        .insert({ mensagens: novasMensagens as any } as any)
        .select("id")
        .single();
      if (error) throw error;
      if (data) setTemplateId((data as any).id);
    }
    setMensagens(novasMensagens);
  };

  const getMensagemFormatada = (status: StatusUsuarioWhatsApp, nome: string): string => {
    const template = mensagens[status] || MENSAGENS_PADRAO_ADMIN[status];
    return template.replace(/\{\{nome\}\}/g, nome || "Cliente");
  };

  return {
    mensagens,
    isLoading,
    salvarTemplates,
    getMensagemFormatada,
    recarregar: carregarTemplates,
  };
}
