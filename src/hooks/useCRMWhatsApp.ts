import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CrmStage = "novo" | "boas_vindas_enviada" | "falta_1_hora_enviada" | "2_dias_enviada" | "cliente";

export interface CRMWhatsAppProfile {
  id: string;
  user_id: string;
  nome: string;
  celular: string | null;
  crm_stage: CrmStage;
  whatsapp_enviado: boolean;
  whatsapp_ultima_mensagem: string | null;
  whatsapp_numero_valido: boolean;
  whatsapp_status: string;
  whatsapp_last_sent_at: string | null;
  whatsapp_followup_stage: number;
  whatsapp_response: boolean;
  created_at: string;
  plano_tipo: string | null;
  status_assinatura: string | null;
}

export type FiltroWhatsApp = "todos" | "nao_compraram" | "nunca_receberam" | "receberam_nao_compraram" | CrmStage;

const PLANOS_NAO_PAGOS = ["free", "demonstracao", "trial"];

export const CRM_STAGES: { value: CrmStage; label: string }[] = [
  { value: "novo", label: "Novo" },
  { value: "boas_vindas_enviada", label: "Boas-vindas enviada" },
  { value: "falta_1_hora_enviada", label: "Falta 1 hora enviada" },
  { value: "2_dias_enviada", label: "2 dias enviada" },
  { value: "cliente", label: "Cliente" },
];

export function useCRMWhatsApp() {
  const [profiles, setProfiles] = useState<CRMWhatsAppProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filtro, setFiltro] = useState<FiltroWhatsApp>("todos");
  const [busca, setBusca] = useState("");

  const carregarProfiles = async (silencioso = false) => {
    if (!silencioso) setIsLoading(true);
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, user_id, nome, celular, crm_stage, whatsapp_enviado, whatsapp_ultima_mensagem, whatsapp_numero_valido, whatsapp_status, whatsapp_last_sent_at, whatsapp_followup_stage, whatsapp_response, created_at");

      if (profilesError) throw profilesError;

      const { data: assinaturasData, error: assinaturasError } = await supabase
        .from("assinaturas")
        .select("user_id, plano_tipo, status");

      if (assinaturasError) throw assinaturasError;

      const assinaturaMap = new Map<string, { plano_tipo: string; status: string }>();
      assinaturasData?.forEach((a) => {
        assinaturaMap.set(a.user_id, { plano_tipo: a.plano_tipo, status: a.status });
      });

      const merged: CRMWhatsAppProfile[] = (profilesData || []).map((p: any) => {
        const assinatura = assinaturaMap.get(p.user_id);
        return {
          ...p,
          crm_stage: p.crm_stage ?? "novo",
          whatsapp_enviado: p.whatsapp_enviado ?? false,
          whatsapp_ultima_mensagem: p.whatsapp_ultima_mensagem ?? null,
          whatsapp_numero_valido: p.whatsapp_numero_valido ?? true,
          whatsapp_status: p.whatsapp_status ?? "never_sent",
          whatsapp_last_sent_at: p.whatsapp_last_sent_at ?? null,
          whatsapp_followup_stage: p.whatsapp_followup_stage ?? 0,
          whatsapp_response: p.whatsapp_response ?? false,
          plano_tipo: assinatura?.plano_tipo ?? null,
          status_assinatura: assinatura?.status ?? null,
        };
      });

      // Only update if we got data (avoid blanking out on transient errors)
      if (merged.length > 0) {
        setProfiles(merged);
      }
    } catch (err) {
      console.error("Erro ao carregar profiles CRM:", err);
    } finally {
      if (!silencioso) setIsLoading(false);
    }
  };

  useEffect(() => {
    carregarProfiles();

    // Subscribe to realtime changes on profiles table (INSERT + UPDATE)
    const channel = supabase
      .channel('crm-profiles-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
        },
        (payload) => {
          console.log('🔄 CRM Realtime event:', payload.eventType, payload.new);
          
          if (payload.eventType === 'INSERT') {
            carregarProfiles(true);
            return;
          }
          
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as any;
            setProfiles((prev) => {
              const exists = prev.some((p) => p.user_id === updated.user_id);
              if (!exists) {
                carregarProfiles(true);
                return prev;
              }
              return prev.map((p) =>
                p.user_id === updated.user_id
                  ? {
                      ...p,
                      crm_stage: updated.crm_stage ?? p.crm_stage,
                      whatsapp_enviado: updated.whatsapp_enviado ?? p.whatsapp_enviado,
                      whatsapp_ultima_mensagem: updated.whatsapp_ultima_mensagem ?? p.whatsapp_ultima_mensagem,
                      whatsapp_numero_valido: updated.whatsapp_numero_valido ?? p.whatsapp_numero_valido,
                      whatsapp_status: updated.whatsapp_status ?? p.whatsapp_status,
                      whatsapp_last_sent_at: updated.whatsapp_last_sent_at ?? p.whatsapp_last_sent_at,
                      whatsapp_followup_stage: updated.whatsapp_followup_stage ?? p.whatsapp_followup_stage,
                      whatsapp_response: updated.whatsapp_response ?? p.whatsapp_response,
                      nome: updated.nome ?? p.nome,
                      celular: updated.celular ?? p.celular,
                    }
                  : p
              );
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 CRM Realtime status:', status);
      });

    // Polling fallback every 5s for reliability (silencioso para não resetar loading)
    const pollInterval = setInterval(() => {
      carregarProfiles(true);
    }, 5000);

    // Refresh when tab becomes visible
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        console.log('👀 CRM tab visible - refreshing...');
        carregarProfiles(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const moverEstagio = async (userId: string, novoEstagio: CrmStage) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          crm_stage: novoEstagio,
          whatsapp_ultima_mensagem: new Date().toISOString(),
          ...(novoEstagio === "boas_vindas_enviada" ? { whatsapp_enviado: true } : {}),
        })
        .eq("user_id", userId);

      if (error) throw error;

      setProfiles((prev) =>
        prev.map((p) =>
          p.user_id === userId
            ? { ...p, crm_stage: novoEstagio, whatsapp_ultima_mensagem: new Date().toISOString() }
            : p
        )
      );
      return true;
    } catch (err) {
      console.error("Erro ao mover estágio:", err);
      return false;
    }
  };

  const profilesFiltrados = profiles.filter((p) => {
    if (busca) {
      const termo = busca.toLowerCase();
      const matchNome = p.nome?.toLowerCase().includes(termo);
      const matchCelular = p.celular?.replace(/\D/g, "").includes(busca.replace(/\D/g, ""));
      if (!matchNome && !matchCelular) return false;
    }

    switch (filtro) {
      case "nao_compraram":
        return !p.plano_tipo || PLANOS_NAO_PAGOS.includes(p.plano_tipo) || p.status_assinatura !== "active";
      case "nunca_receberam":
        return p.whatsapp_status === "never_sent";
      case "receberam_nao_compraram":
        return p.whatsapp_status !== "never_sent" && (!p.plano_tipo || PLANOS_NAO_PAGOS.includes(p.plano_tipo));
      case "novo":
      case "boas_vindas_enviada":
      case "falta_1_hora_enviada":
      case "2_dias_enviada":
      case "cliente":
        return p.crm_stage === filtro;
      default:
        return true;
    }
  });

  return {
    profiles: profilesFiltrados,
    allProfiles: profiles,
    totalProfiles: profiles.length,
    isLoading,
    filtro,
    setFiltro,
    busca,
    setBusca,
    recarregar: () => carregarProfiles(false),
    moverEstagio,
  };
}
