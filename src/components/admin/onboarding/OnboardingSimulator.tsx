import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  Smartphone, 
  ClipboardList, 
  TrendingUp, 
  Check, 
  ArrowRight,
  Rocket,
  Target,
  Wrench,
  ShoppingCart,
  Cog,
  X,
  ChevronLeft,
  Package,
  Play,
  Flag,
  MessageCircle,
  Clock,
  PartyPopper,
  FileText,
  GitBranch,
  MousePointer
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOnboardingFlow } from '@/hooks/useOnboardingFlow';
import type { FlowNode, FlowEdge, BotaoAcao } from '@/components/admin/flow/types';
import logoMec from '@/assets/logo-mec-novo.png';

interface PerfilInfo {
  id: string;
  nome: string;
  descricao: string;
  plano: string;
  status: string;
}

interface OnboardingSimulatorProps {
  perfil: PerfilInfo;
  onReiniciar: () => void;
}

const ICON_MAP: Record<string, React.ElementType> = {
  'play': Play,
  'git-branch': GitBranch,
  'mouse-pointer': MousePointer,
  'flag': Flag,
  'file-text': FileText,
  'user': User,
  'package': Package,
  'clipboard-list': ClipboardList,
  'trending-up': TrendingUp,
  'smartphone': Smartphone,
  'message-circle': MessageCircle,
  'clock': Clock,
  'party-popper': PartyPopper,
  'wrench': Wrench,
  'shopping-cart': ShoppingCart,
  'cog': Cog,
  'target': Target,
  'rocket': Rocket,
};

type EtapaSimulacao = 'escolha_inicial' | 'selecao_tipo' | 'passos' | 'concluido';
type TipoNegocio = 'assistencia' | 'vendas' | null;

export function OnboardingSimulator({ perfil, onReiniciar }: OnboardingSimulatorProps) {
  const { flowConfig, loading } = useOnboardingFlow();
  const [etapa, setEtapa] = useState<EtapaSimulacao>('escolha_inicial');
  const [tipoNegocio, setTipoNegocio] = useState<TipoNegocio>(null);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [navigationHistory, setNavigationHistory] = useState<string[]>([]);
  const [acaoLog, setAcaoLog] = useState<string[]>([]);

  // Log de ação
  const logAcao = useCallback((acao: string) => {
    setAcaoLog(prev => [...prev.slice(-9), `[${new Date().toLocaleTimeString()}] ${acao}`]);
  }, []);

  // Nodes e edges do flow
  const nodes: FlowNode[] = flowConfig?.nodes || [];
  const edges: FlowEdge[] = flowConfig?.edges || [];

  // Nós de ação visíveis
  const actionNodes = useMemo(() => {
    return nodes.filter(n => 
      ['inicio', 'decisao', 'acao', 'conteudo', 'mensagem', 'aguardar', 'celebracao'].includes(n.data.tipo)
    );
  }, [nodes]);

  // Encontrar primeiro nó
  const findFirstActionNode = useCallback(() => {
    const startNode = nodes.find(n => n.data.tipo === 'inicio');
    if (startNode) return startNode;
    return actionNodes[0] || null;
  }, [nodes, actionNodes]);

  // Nó atual
  const currentNode = useMemo(() => {
    if (currentNodeId) {
      const found = nodes.find(n => n.id === currentNodeId);
      if (found) return found;
    }
    return findFirstActionNode();
  }, [currentNodeId, nodes, findFirstActionNode]);

  // Encontrar próximo nó
  const findNextNode = useCallback((fromNodeId: string): FlowNode | null => {
    const fromNode = nodes.find(n => n.id === fromNodeId);
    if (!fromNode) return null;

    if (fromNode.data.tipo === 'decisao') {
      const outgoingEdges = edges.filter(e => e.source === fromNodeId);
      let edge = outgoingEdges.find(e => 
        e.label?.toString().toLowerCase().includes(tipoNegocio || 'assistencia')
      );
      if (!edge) {
        edge = tipoNegocio === 'assistencia' 
          ? outgoingEdges.find(e => e.sourceHandle === 'left') 
          : outgoingEdges.find(e => e.sourceHandle === 'right');
      }
      if (!edge && outgoingEdges.length > 0) {
        edge = outgoingEdges[0];
      }
      if (!edge) return null;
      
      const nextNode = nodes.find(n => n.id === edge!.target);
      if (!nextNode || nextNode.data.tipo === 'fim') return null;
      return nextNode;
    }

    const nextEdge = edges.find(e => e.source === fromNodeId);
    if (!nextEdge) return null;
    
    const nextNode = nodes.find(n => n.id === nextEdge.target);
    if (!nextNode || nextNode.data.tipo === 'fim') return null;
    return nextNode;
  }, [edges, nodes, tipoNegocio]);

  // Navegar para um nó
  const navigateToNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    setNavigationHistory(prev => [...prev, currentNode?.id || ''].filter(Boolean));
    setCurrentNodeId(nodeId);
    logAcao(`Navegou para: ${node.data.label}`);
  }, [nodes, currentNode, logAcao]);

  // Handlers
  const handleEscolherPrimeirosPassos = () => {
    logAcao('Clicou em "Primeiros Passos"');
    setEtapa('selecao_tipo');
  };

  const handlePular = () => {
    logAcao('Pulou o onboarding');
    setEtapa('concluido');
  };

  const handleSelecionarTipo = (tipo: TipoNegocio) => {
    logAcao(`Selecionou tipo: ${tipo === 'assistencia' ? 'Assistência Técnica' : 'Venda de Dispositivos'}`);
    setTipoNegocio(tipo);
    setEtapa('passos');
    
    // Iniciar do primeiro nó se tiver flow
    const firstNode = findFirstActionNode();
    if (firstNode) {
      setCurrentNodeId(firstNode.id);
    }
  };

  const handleNext = () => {
    if (currentNode) {
      const nextNode = findNextNode(currentNode.id);
      if (nextNode) {
        navigateToNode(nextNode.id);
      } else {
        logAcao('Onboarding concluído!');
        setEtapa('concluido');
      }
    }
  };

  const handlePrev = () => {
    if (navigationHistory.length > 0) {
      const prevNodeId = navigationHistory[navigationHistory.length - 1];
      setNavigationHistory(prev => prev.slice(0, -1));
      setCurrentNodeId(prevNodeId);
      logAcao('Voltou para passo anterior');
    }
  };

  const handleButtonClick = (botao: BotaoAcao) => {
    logAcao(`Clicou no botão: "${botao.texto}"`);
    
    if (botao.destinoNodeId) {
      navigateToNode(botao.destinoNodeId);
    } else if (botao.rota === '__proximo__' || !botao.rota) {
      handleNext();
    } else if (botao.rota === '__pular__' || botao.rota === '__fechar__') {
      handlePular();
    } else {
      logAcao(`Navegaria para rota: ${botao.rota}`);
      handleNext();
    }
  };

  const getStepIcon = (icone?: string) => {
    const Icon = ICON_MAP[icone || 'file-text'] || FileText;
    return <Icon className="h-6 w-6" />;
  };

  // Calcular progresso
  const currentStepIndex = useMemo(() => {
    if (!currentNode) return 0;
    const index = actionNodes.findIndex(n => n.id === currentNode.id);
    return index >= 0 ? index : 0;
  }, [currentNode, actionNodes]);

  const progressPercent = actionNodes.length > 0 
    ? ((currentStepIndex + 1) / actionNodes.length) * 100 
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Etapa: Escolha inicial
  if (etapa === 'escolha_inicial') {
    return (
      <div className="w-full max-w-lg mx-auto">
        <div className="text-center mb-8">
          <img src={logoMec} alt="MEC App" className="h-12 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Bem-vindo ao MEC App!</h1>
          <p className="text-muted-foreground">Como você gostaria de começar?</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleEscolherPrimeirosPassos}
            className="w-full border-2 rounded-xl p-6 text-left transition-all hover:border-primary hover:shadow-lg bg-card"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/20 rounded-lg">
                <Rocket className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-lg">Primeiros Passos</h3>
                  <Badge className="bg-primary text-primary-foreground">Recomendado</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Te guiaremos passo a passo para configurar seu sistema
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={handlePular}
            className="w-full border-2 rounded-xl p-5 text-left transition-all hover:border-muted-foreground/50 bg-muted/30"
          >
            <div className="flex items-center gap-4">
              <ArrowRight className="h-6 w-6 text-muted-foreground" />
              <div>
                <h3 className="font-medium">Já sei como usar</h3>
                <p className="text-sm text-muted-foreground">Ir direto para o sistema</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // Etapa: Seleção de tipo
  if (etapa === 'selecao_tipo') {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setEtapa('escolha_inicial')} className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={handlePular} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
            Pular <X className="h-4 w-4" />
          </button>
        </div>

        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-4">
            <Target className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold mb-2">Qual é o seu foco principal?</h2>
          <p className="text-muted-foreground text-sm">
            Selecione a opção que melhor descreve seu negócio
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <button
            onClick={() => handleSelecionarTipo('assistencia')}
            className="border-2 rounded-xl p-6 text-left transition-all hover:border-primary hover:shadow-lg bg-card"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-orange-500/20 rounded-lg">
                <Wrench className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Assistência Técnica</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Consertos, manutenção e reparos
                </p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Check className="h-3 w-3 text-primary" /> Ordens de Serviço
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3 w-3 text-primary" /> Controle de Peças
                  </li>
                </ul>
              </div>
            </div>
          </button>

          <button
            onClick={() => handleSelecionarTipo('vendas')}
            className="border-2 rounded-xl p-6 text-left transition-all hover:border-primary hover:shadow-lg bg-card"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <ShoppingCart className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Venda de Dispositivos</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Compra e venda de eletrônicos
                </p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Check className="h-3 w-3 text-primary" /> Estoque de Dispositivos
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3 w-3 text-primary" /> Controle de Vendas
                  </li>
                </ul>
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // Etapa: Concluído
  if (etapa === 'concluido') {
    return (
      <div className="w-full max-w-md mx-auto text-center">
        <div className="mx-auto w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
          <Check className="h-10 w-10 text-green-500" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Simulação Concluída!</h2>
        <p className="text-muted-foreground mb-6">
          O usuário completou ou pulou o onboarding
        </p>
        <Button onClick={onReiniciar}>
          <Play className="h-4 w-4 mr-2" />
          Reiniciar Simulação
        </Button>

        {/* Log de ações */}
        {acaoLog.length > 0 && (
          <div className="mt-6 p-4 bg-muted rounded-lg text-left">
            <h4 className="text-sm font-medium mb-2">Log de Ações:</h4>
            <div className="space-y-1 text-xs text-muted-foreground font-mono max-h-40 overflow-y-auto">
              {acaoLog.map((log, i) => (
                <div key={i}>{log}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Etapa: Passos do onboarding (usando flow config)
  const currentNodeData = currentNode?.data;
  const botoes = currentNodeData?.botoes || [];
  const nextNode = currentNode ? findNextNode(currentNode.id) : null;

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <img src={logoMec} alt="MEC App" className="h-8" />
          <Badge variant="outline" className="text-xs">
            {tipoNegocio === 'assistencia' ? 'Assistência' : 'Vendas'}
          </Badge>
        </div>
        <button onClick={handlePular} className="text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Progresso */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Passo {currentStepIndex + 1} de {actionNodes.length}</span>
          <span>{Math.round(progressPercent)}%</span>
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>

      {/* Card do passo atual */}
      {currentNode && currentNodeData && (
        <div className="border-2 rounded-xl p-6 bg-card">
          <div className="flex items-start gap-4 mb-4">
            <div 
              className="p-3 rounded-lg"
              style={{ backgroundColor: `${currentNodeData.cor}20` }}
            >
              <div style={{ color: currentNodeData.cor }}>
                {getStepIcon(currentNodeData.icone)}
              </div>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{currentNodeData.label}</h3>
              {currentNodeData.subtitulo && (
                <p className="text-sm text-muted-foreground">{currentNodeData.subtitulo}</p>
              )}
            </div>
          </div>

          {currentNodeData.descricao && (
            <p className="text-sm text-muted-foreground mb-6">
              {currentNodeData.descricao}
            </p>
          )}

          {/* Botões */}
          <div className="space-y-2">
            {botoes.length > 0 ? (
              botoes.map((botao) => (
                <Button 
                  key={botao.id}
                  className="w-full"
                  variant={botao.estilo === 'primary' ? 'default' : 
                          botao.estilo === 'destructive' ? 'destructive' :
                          botao.estilo as 'secondary' | 'outline' | 'ghost'}
                  onClick={() => handleButtonClick(botao)}
                >
                  {botao.texto}
                </Button>
              ))
            ) : currentNodeData.botaoTexto ? (
              <Button className="w-full" onClick={handleNext}>
                {currentNodeData.botaoTexto}
              </Button>
            ) : (
              <Button className="w-full" onClick={handleNext}>
                Próximo
              </Button>
            )}
          </div>

          {currentNodeData.rota && (
            <p className="text-xs text-muted-foreground mt-3 text-center">
              Rota: {currentNodeData.rota}
            </p>
          )}
        </div>
      )}

      {/* Próximo passo */}
      {nextNode && (
        <div className="mt-3 text-center text-xs text-muted-foreground">
          Próximo: {nextNode.data.label}
        </div>
      )}

      {/* Navegação */}
      <div className="flex justify-between mt-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePrev}
          disabled={navigationHistory.length === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Anterior
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleNext}
          disabled={!nextNode}
        >
          Próximo
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
