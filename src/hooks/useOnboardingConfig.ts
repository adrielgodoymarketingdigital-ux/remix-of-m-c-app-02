import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  OnboardingConfig, 
  ConfigPassos, 
  TextosPersonalizados,
  CONFIG_PASSOS_PADRAO,
  TEXTOS_PADRAO 
} from '@/types/onboarding-config';
import { toast } from 'sonner';

const CONFIG_ID = '00000000-0000-0000-0000-000000000001';

export function useOnboardingConfig() {
  const [config, setConfig] = useState<OnboardingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('onboarding_config')
        .select('*')
        .eq('id', CONFIG_ID)
        .single();

      if (error) {
        console.error('[OnboardingConfig] Erro ao carregar:', error);
        return;
      }

      if (data) {
        setConfig({
          id: data.id,
          ativo: data.ativo,
          publico_alvo: data.publico_alvo || ['trial'],
          mostrar_para_usuarios_ativos: data.mostrar_para_usuarios_ativos,
          config_passos: (data.config_passos as unknown as ConfigPassos) || CONFIG_PASSOS_PADRAO,
          textos_personalizados: (data.textos_personalizados as unknown as TextosPersonalizados) || TEXTOS_PADRAO,
          updated_at: data.updated_at,
          updated_by: data.updated_by
        });
      }
    } catch (err) {
      console.error('[OnboardingConfig] Erro inesperado:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveConfig = useCallback(async (newConfig: Partial<OnboardingConfig>) => {
    try {
      setSaving(true);

      const { data: { user } } = await supabase.auth.getUser();
      
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        updated_by: user?.id
      };

      if (newConfig.ativo !== undefined) updateData.ativo = newConfig.ativo;
      if (newConfig.publico_alvo) updateData.publico_alvo = newConfig.publico_alvo;
      if (newConfig.mostrar_para_usuarios_ativos !== undefined) {
        updateData.mostrar_para_usuarios_ativos = newConfig.mostrar_para_usuarios_ativos;
      }
      if (newConfig.config_passos) updateData.config_passos = newConfig.config_passos;
      if (newConfig.textos_personalizados) updateData.textos_personalizados = newConfig.textos_personalizados;

      const { error } = await supabase
        .from('onboarding_config')
        .update(updateData)
        .eq('id', CONFIG_ID);

      if (error) {
        console.error('[OnboardingConfig] Erro ao salvar:', error);
        toast.error('Erro ao salvar configurações');
        return false;
      }

      toast.success('Configurações salvas com sucesso!');
      await loadConfig();
      return true;
    } catch (err) {
      console.error('[OnboardingConfig] Erro inesperado ao salvar:', err);
      toast.error('Erro inesperado ao salvar');
      return false;
    } finally {
      setSaving(false);
    }
  }, [loadConfig]);

  const toggleAtivo = useCallback(async () => {
    if (!config) return;
    await saveConfig({ ativo: !config.ativo });
  }, [config, saveConfig]);

  const updatePublicoAlvo = useCallback(async (planos: string[]) => {
    await saveConfig({ publico_alvo: planos });
  }, [saveConfig]);

  const toggleMostrarParaAtivos = useCallback(async () => {
    if (!config) return;
    await saveConfig({ mostrar_para_usuarios_ativos: !config.mostrar_para_usuarios_ativos });
  }, [config, saveConfig]);

  const updateConfigPassos = useCallback(async (passos: ConfigPassos) => {
    await saveConfig({ config_passos: passos });
  }, [saveConfig]);

  const updateTextos = useCallback(async (textos: TextosPersonalizados) => {
    await saveConfig({ textos_personalizados: textos });
  }, [saveConfig]);

  const resetToDefaults = useCallback(async () => {
    await saveConfig({
      config_passos: CONFIG_PASSOS_PADRAO,
      textos_personalizados: TEXTOS_PADRAO
    });
  }, [saveConfig]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  return {
    config,
    loading,
    saving,
    reload: loadConfig,
    saveConfig,
    toggleAtivo,
    updatePublicoAlvo,
    toggleMostrarParaAtivos,
    updateConfigPassos,
    updateTextos,
    resetToDefaults
  };
}
