import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { OnboardingFlowConfig, FlowNode, FlowEdge } from '@/components/admin/flow/types';

const CONFIG_ID = '00000000-0000-0000-0000-000000000001';

export interface OnboardingStep {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  route?: string;
  actionText?: string;
  tipo: string;
}

export function useOnboardingFlow() {
  const [flowConfig, setFlowConfig] = useState<OnboardingFlowConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Carregar fluxo do banco
  const loadFlow = useCallback(async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('onboarding_config')
        .select('flow_config')
        .eq('id', CONFIG_ID)
        .single();

      if (error) {
        console.error('[OnboardingFlow] Erro ao carregar:', error);
        return;
      }

      if (data?.flow_config) {
        const config = data.flow_config as unknown as OnboardingFlowConfig;
        setFlowConfig(config);
      }
    } catch (err) {
      console.error('[OnboardingFlow] Erro inesperado:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Salvar fluxo no banco
  const saveFlow = useCallback(async (config: OnboardingFlowConfig) => {
    try {
      setSaving(true);

      const { data: { user } } = await supabase.auth.getUser();

      const updatedConfig = {
        ...config,
        metadata: {
          ...config.metadata,
          versao: (config.metadata?.versao || 0) + 1,
          atualizado_em: new Date().toISOString(),
        },
      };

      const { error } = await supabase
        .from('onboarding_config')
        .update({
          flow_config: JSON.parse(JSON.stringify(updatedConfig)),
          updated_at: new Date().toISOString(),
          updated_by: user?.id,
        })
        .eq('id', CONFIG_ID);

      if (error) {
        console.error('[OnboardingFlow] Erro ao salvar:', error);
        toast.error('Erro ao salvar fluxo');
        return false;
      }

      setFlowConfig(updatedConfig);
      toast.success('Fluxo salvo com sucesso!');
      return true;
    } catch (err) {
      console.error('[OnboardingFlow] Erro inesperado ao salvar:', err);
      toast.error('Erro inesperado ao salvar');
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  // Converter fluxo para passos do onboarding
  const convertFlowToSteps = useCallback((
    config: OnboardingFlowConfig | null,
    tipoNegocio: 'assistencia' | 'vendas'
  ): OnboardingStep[] => {
    if (!config || !config.nodes.length) return [];

    const { nodes, edges } = config;

    // Encontrar nó inicial
    const startNode = nodes.find(n => n.data.tipo === 'inicio');
    if (!startNode) return [];

    const steps: OnboardingStep[] = [];
    const visited = new Set<string>();
    let currentNode: FlowNode | undefined = startNode;

    while (currentNode && !visited.has(currentNode.id)) {
      visited.add(currentNode.id);

      // Adicionar apenas nós de ação, conteúdo, mensagem, etc.
      if (['acao', 'conteudo', 'mensagem', 'aguardar', 'celebracao'].includes(currentNode.data.tipo)) {
        steps.push({
          id: currentNode.id,
          title: currentNode.data.label,
          description: currentNode.data.descricao,
          icon: currentNode.data.icone,
          route: currentNode.data.rota,
          actionText: currentNode.data.botaoTexto,
          tipo: currentNode.data.tipo,
        });
      }

      // Se for decisão, seguir caminho baseado no tipo de negócio
      if (currentNode.data.tipo === 'decisao') {
        const outgoingEdges = edges.filter(e => e.source === currentNode!.id);

        // Tentar encontrar edge com label correspondente
        let nextEdge = outgoingEdges.find(e =>
          e.label?.toString().toLowerCase().includes(tipoNegocio)
        );

        // Se não encontrou, tentar por sourceHandle
        if (!nextEdge) {
          nextEdge = tipoNegocio === 'assistencia'
            ? outgoingEdges.find(e => e.sourceHandle === 'left')
            : outgoingEdges.find(e => e.sourceHandle === 'right');
        }

        // Fallback para qualquer edge
        if (!nextEdge && outgoingEdges.length > 0) {
          nextEdge = outgoingEdges[0];
        }

        currentNode = nextEdge ? nodes.find(n => n.id === nextEdge!.target) : undefined;
      } else if (currentNode.data.tipo === 'fim') {
        break;
      } else {
        // Seguir único caminho
        const nextEdge = edges.find(e => e.source === currentNode!.id);
        currentNode = nextEdge ? nodes.find(n => n.id === nextEdge.target) : undefined;
      }

      // Proteção contra loops infinitos
      if (steps.length > 20) break;
    }

    return steps;
  }, []);

  // Obter próximo passo baseado no nó atual e escolha do usuário
  const getNextStep = useCallback((
    config: OnboardingFlowConfig | null,
    currentNodeId: string,
    userChoice?: string
  ): FlowNode | null => {
    if (!config) return null;

    const { nodes, edges } = config;
    const currentNode = nodes.find(n => n.id === currentNodeId);
    if (!currentNode) return null;

    // Se for decisão, usar a escolha do usuário
    if (currentNode.data.tipo === 'decisao' && userChoice) {
      const outgoingEdges = edges.filter(e => e.source === currentNodeId);
      const nextEdge = outgoingEdges.find(e =>
        e.label?.toString().toLowerCase().includes(userChoice.toLowerCase())
      ) || outgoingEdges.find(e =>
        userChoice === 'assistencia' ? e.sourceHandle === 'left' : e.sourceHandle === 'right'
      );

      return nextEdge ? nodes.find(n => n.id === nextEdge.target) || null : null;
    }

    // Seguir único caminho
    const nextEdge = edges.find(e => e.source === currentNodeId);
    return nextEdge ? nodes.find(n => n.id === nextEdge.target) || null : null;
  }, []);

  useEffect(() => {
    loadFlow();
  }, [loadFlow]);

  return {
    flowConfig,
    loading,
    saving,
    loadFlow,
    saveFlow,
    convertFlowToSteps,
    getNextStep,
  };
}