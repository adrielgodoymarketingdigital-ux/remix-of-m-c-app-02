import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const STEP_CACHE_KEY = "mec_onboarding_step";

function getCachedStep(): number {
  try {
    const v = sessionStorage.getItem(STEP_CACHE_KEY);
    if (v) return Math.max(1, parseInt(v, 10));
  } catch {}
  return 1;
}

function setCachedStep(step: number) {
  try { sessionStorage.setItem(STEP_CACHE_KEY, String(step)); } catch {}
}

function clearCachedStep() {
  try { sessionStorage.removeItem(STEP_CACHE_KEY); } catch {}
}

interface OnboardingData {
  nomeAssistencia: string;
  cidade: string;
  estado: string;
  tipoNegocio: "assistencia" | "vendas" | null;
  primeiroClienteId: string | null;
  primeiraOSSimulada: boolean;
  onboardingCompleted: boolean;
  objetivoOnboarding: string | null;
}

interface OnboardingProgress {
  currentStep: number;
  totalSteps: number;
  percentComplete: number;
  data: OnboardingData;
}

interface OSTesteData {
  clienteNome: string;
  clienteTelefone: string;
  tipoDispositivo: string;
  defeito: string;
  checklist?: any;
  avarias?: any[];
  servicoNome?: string;
  servicoValor?: number;
  servicoCusto?: number;
}

const emptyData: OnboardingData = {
  nomeAssistencia: "",
  cidade: "",
  estado: "",
  tipoNegocio: null,
  primeiroClienteId: null,
  primeiraOSSimulada: false,
  onboardingCompleted: false,
  objetivoOnboarding: null,
};

export function useOnboardingObrigatorio() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [osTesteResumo, setOsTesteResumo] = useState<any>(null);

  // Inicializa já com o step cacheado no sessionStorage para evitar flash no passo 1
  const [progress, setProgress] = useState<OnboardingProgress>(() => {
    const cachedStep = getCachedStep();
    return {
      currentStep: cachedStep,
      totalSteps: 6,
      percentComplete: Math.min(100, ((Math.min(cachedStep, 6) - 1) / 6) * 100),
      data: emptyData,
    };
  });

  const updateStep = useCallback((step: number) => {
    setCachedStep(step);
    setProgress(prev => ({
      ...prev,
      currentStep: step,
      percentComplete: Math.min(100, ((Math.min(step, 6) - 1) / 6) * 100),
    }));
  }, []);

  const loadProgress = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_onboarding")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const onboardingData: OnboardingData = {
          nomeAssistencia: (data as any).nome_assistencia || "",
          cidade: (data as any).cidade || "",
          estado: (data as any).estado || "",
          tipoNegocio: data.tipo_negocio as "assistencia" | "vendas" | null,
          primeiroClienteId: (data as any).primeiro_cliente_id || null,
          primeiraOSSimulada: (data as any).primeira_os_simulada || false,
          onboardingCompleted: (data as any).onboarding_obrigatorio_completed || false,
          objetivoOnboarding: (data as any).objetivo_onboarding || null,
        };

        // Derivar o step mínimo baseado no banco
        let dbStep = 1;
        if (onboardingData.objetivoOnboarding) dbStep = 2;
        if (onboardingData.primeiroClienteId) dbStep = 5;
        if (onboardingData.onboardingCompleted) dbStep = 7;

        // Nunca regredir — o step real é o maior entre banco e cache local
        const cachedStep = getCachedStep();
        const finalStep = Math.max(dbStep, cachedStep);
        setCachedStep(finalStep);

        setProgress(prev => ({
          currentStep: finalStep,
          totalSteps: 6,
          percentComplete: Math.min(100, ((Math.min(finalStep, 6) - 1) / 6) * 100),
          data: onboardingData,
        }));
      }
    } catch (error) {
      console.error("Error loading onboarding progress:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  // Passo 1: Salvar objetivo
  const saveObjetivo = useCallback(async (objetivo: string) => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão não encontrada");

      const { error } = await supabase
        .from("user_onboarding")
        .upsert({
          user_id: session.user.id,
          objetivo_onboarding: objetivo,
          updated_at: new Date().toISOString(),
        } as any, { onConflict: "user_id" });

      if (error) throw error;

      setCachedStep(2);
      setProgress(prev => ({
        ...prev,
        currentStep: 2,
        percentComplete: (1 / 6) * 100,
        data: { ...prev.data, objetivoOnboarding: objetivo },
      }));

      return true;
    } catch (error: any) {
      console.error("Error saving objetivo:", error);
      toast({
        title: "Erro ao salvar",
        description: error.message || "Não foi possível salvar o objetivo.",
        variant: "destructive",
      });
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  // Avançar para passo 3
  const advanceToStep3 = useCallback(() => {
    setCachedStep(3);
    setProgress(prev => ({
      ...prev,
      currentStep: 3,
      percentComplete: (2 / 6) * 100,
    }));
  }, []);

  // Passo 3: Criar OS de teste
  const saveOSTeste = useCallback(async (osData: OSTesteData) => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão não encontrada");

      // 1. Criar cliente
      const { data: cliente, error: clienteError } = await supabase
        .from("clientes")
        .insert({
          user_id: session.user.id,
          nome: osData.clienteNome,
          telefone: osData.clienteTelefone || null,
        })
        .select()
        .single();

      if (clienteError) throw clienteError;

      // 2. Gerar número da OS
      const { data: osNumber } = await supabase.rpc('generate_os_number', { p_user_id: session.user.id });

      // 3. Montar avarias com servico
      const avariasObj: any = {};
      if (osData.avarias && osData.avarias.length > 0) {
        avariasObj.marcacoes = osData.avarias;
      }
      if (osData.servicoNome) {
        avariasObj.servicos_inline = [{
          nome: osData.servicoNome,
          valor: osData.servicoValor || 0,
        }];
      }

      // 4. Criar OS com is_teste = true
      const { data: osCreated, error: osError } = await supabase
        .from("ordens_servico")
        .insert({
          user_id: session.user.id,
          cliente_id: cliente.id,
          numero_os: osNumber || `OS-TEST-${Date.now()}`,
          dispositivo_tipo: osData.tipoDispositivo,
          dispositivo_marca: "Teste",
          dispositivo_modelo: osData.tipoDispositivo,
          defeito_relatado: osData.defeito,
          total: osData.servicoValor || 0,
          status: "pendente",
          is_teste: true,
          avarias: Object.keys(avariasObj).length > 0 ? avariasObj : null,
        } as any)
        .select()
        .single();

      if (osError) throw osError;

      // 5. Atualizar onboarding
      const { error } = await supabase
        .from("user_onboarding")
        .upsert({
          user_id: session.user.id,
          primeiro_cliente_id: cliente.id,
          step_cliente_cadastrado: true,
          step_cliente_cadastrado_at: new Date().toISOString(),
          primeira_os_simulada: true,
          primeira_os_simulada_at: new Date().toISOString(),
          step_os_criada: true,
          step_os_criada_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any, { onConflict: "user_id" });

      if (error) throw error;

      setOsTesteResumo({
        numero_os: osCreated.numero_os || osNumber,
        clienteNome: osData.clienteNome,
        dispositivo: osData.tipoDispositivo,
        defeito: osData.defeito,
        checklist: osData.checklist,
        avarias: osData.avarias,
        servico: osData.servicoNome ? { nome: osData.servicoNome, valor: osData.servicoValor, custo: osData.servicoCusto } : null,
        valor: osData.servicoValor || 0,
      });

      setCachedStep(4);
      setProgress(prev => ({
        ...prev,
        currentStep: 4,
        percentComplete: (3 / 6) * 100,
        data: { ...prev.data, primeiroClienteId: cliente.id, primeiraOSSimulada: true },
      }));

      return true;
    } catch (error: any) {
      console.error("Error saving OS teste:", error);
      toast({
        title: "Erro ao salvar",
        description: error.message || "Não foi possível criar a OS de teste.",
        variant: "destructive",
      });
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  // Avançar para passo 5
  const advanceToStep5 = useCallback(() => {
    setCachedStep(5);
    setProgress(prev => ({
      ...prev,
      currentStep: 5,
      percentComplete: (4 / 6) * 100,
    }));
  }, []);

  // Avançar para passo 6
  const advanceToStep6 = useCallback(() => {
    setCachedStep(6);
    setProgress(prev => ({
      ...prev,
      currentStep: 6,
      percentComplete: (5 / 6) * 100,
    }));
  }, []);

  // Finalizar onboarding
  const markOnboardingCompleted = useCallback(async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão não encontrada");

      const { error } = await supabase
        .from("user_onboarding")
        .upsert({
          user_id: session.user.id,
          onboarding_obrigatorio_completed: true,
          onboarding_obrigatorio_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any, { onConflict: "user_id" });

      if (error) throw error;

      clearCachedStep();
      setProgress(prev => ({
        ...prev,
        currentStep: 7,
        percentComplete: 100,
        data: { ...prev.data, onboardingCompleted: true },
      }));

      return true;
    } catch (error: any) {
      console.error("Error marking onboarding completed:", error);
      toast({
        title: "Erro ao finalizar",
        description: error.message || "Não foi possível finalizar o onboarding.",
        variant: "destructive",
      });
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  return {
    loading,
    saving,
    progress,
    osTesteResumo,
    saveObjetivo,
    advanceToStep3,
    saveOSTeste,
    advanceToStep5,
    advanceToStep6,
    markOnboardingCompleted,
    reload: loadProgress,
  };
}
