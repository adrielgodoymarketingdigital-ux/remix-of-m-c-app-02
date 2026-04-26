import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Play,
  User,
  Package,
  ClipboardList,
  TrendingUp,
  Smartphone,
  MessageCircle,
  Clock,
  PartyPopper,
  FileText,
  GitBranch,
  Flag,
  MousePointer,
} from 'lucide-react';
import type { FlowNode, FlowEdge, BotaoAcao } from './types';
import { cn } from '@/lib/utils';

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
};

interface OnboardingFlowPreviewProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  selectedNodeId?: string;
  onNodeSelect?: (nodeId: string) => void;
}

type SimulationType = 'assistencia' | 'vendas';

export function OnboardingFlowPreview({ 
  nodes, 
  edges, 
  selectedNodeId,
  onNodeSelect 
}: OnboardingFlowPreviewProps) {
  const [simulationType, setSimulationType] = useState<SimulationType>('assistencia');
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [navigationHistory, setNavigationHistory] = useState<string[]>([]);

  // Converter fluxo para passos lineares baseado na simulação
  // Incluir todos os tipos de nós visíveis: inicio, decisao, acao, etc.
  const actionNodes = useMemo(() => {
    return nodes.filter(n => 
      ['inicio', 'decisao', 'acao', 'conteudo', 'mensagem', 'aguardar', 'celebracao'].includes(n.data.tipo)
    );
  }, [nodes]);

  // Encontrar primeiro nó seguindo o fluxo (agora inclui início e decisão)
  const findFirstActionNode = useCallback(() => {
    // Retorna o nó de início diretamente, já que agora ele é visível
    const startNode = nodes.find(n => n.data.tipo === 'inicio');
    if (startNode) return startNode;
    
    // Fallback para o primeiro nó visível
    return actionNodes[0] || null;
  }, [nodes, actionNodes]);

  // Encontrar nó atual ou inicial
  const currentNode = useMemo(() => {
    if (currentNodeId) {
      const found = nodes.find(n => n.id === currentNodeId);
      if (found) return found;
    }
    return findFirstActionNode();
  }, [currentNodeId, nodes, findFirstActionNode]);

  // Calcular índice atual baseado em nós de ação
  const currentStepIndex = useMemo(() => {
    if (!currentNode) return 0;
    const index = actionNodes.findIndex(n => n.id === currentNode.id);
    return index >= 0 ? index : 0;
  }, [currentNode, actionNodes]);

  const progressPercent = actionNodes.length > 0 
    ? ((currentStepIndex + 1) / actionNodes.length) * 100 
    : 0;

  // Encontrar próximo nó seguindo edges
  const findNextNode = useCallback((fromNodeId: string): FlowNode | null => {
    const currentNode = nodes.find(n => n.id === fromNodeId);
    if (!currentNode) return null;

    // Se o nó atual for decisão, seguir baseado no tipo de simulação
    if (currentNode.data.tipo === 'decisao') {
      const outgoingEdges = edges.filter(e => e.source === fromNodeId);
      let edge = outgoingEdges.find(e => 
        e.label?.toString().toLowerCase().includes(simulationType)
      );
      if (!edge) {
        edge = simulationType === 'assistencia' 
          ? outgoingEdges.find(e => e.sourceHandle === 'left') 
          : outgoingEdges.find(e => e.sourceHandle === 'right');
      }
      if (!edge && outgoingEdges.length > 0) {
        edge = outgoingEdges[0];
      }
      if (!edge) return null;
      
      const nextNode = nodes.find(n => n.id === edge!.target);
      if (!nextNode) return null;
      
      // Se for fim, retornar null
      if (nextNode.data.tipo === 'fim') return null;
      
      return nextNode;
    }

    // Para outros tipos, seguir a edge normal
    const nextEdge = edges.find(e => e.source === fromNodeId);
    if (!nextEdge) return null;
    
    const nextNode = nodes.find(n => n.id === nextEdge.target);
    if (!nextNode) return null;
    
    // Se for fim, retornar null
    if (nextNode.data.tipo === 'fim') return null;
    
    // Retornar o próximo nó (agora inclui decisão)
    return nextNode;
  }, [edges, nodes, simulationType]);

  // Navegar para um nó específico
  const navigateToNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    setNavigationHistory(prev => [...prev, currentNode?.id || ''].filter(Boolean));
    setCurrentNodeId(nodeId);
    onNodeSelect?.(nodeId);
  }, [nodes, currentNode, onNodeSelect]);

  // Lidar com clique em botão
  const handleButtonClick = useCallback((botao: BotaoAcao) => {
    if (botao.destinoNodeId) {
      // Navegar para nó específico
      navigateToNode(botao.destinoNodeId);
    } else if (botao.rota === '__proximo__' || !botao.rota) {
      // Próximo passo automático
      if (currentNode) {
        const nextNode = findNextNode(currentNode.id);
        if (nextNode) {
          navigateToNode(nextNode.id);
        }
      }
    } else if (botao.rota === '__pular__' || botao.rota === '__fechar__') {
      // Simular pular/fechar - resetar para início
      handleReset();
    } else {
      // É uma rota do sistema - simular navegação
      console.log('[Preview] Navegaria para:', botao.rota);
      // Avançar para próximo passo
      if (currentNode) {
        const nextNode = findNextNode(currentNode.id);
        if (nextNode) {
          navigateToNode(nextNode.id);
        }
      }
    }
  }, [currentNode, findNextNode, navigateToNode]);

  const handlePrev = () => {
    if (navigationHistory.length > 0) {
      const prevNodeId = navigationHistory[navigationHistory.length - 1];
      setNavigationHistory(prev => prev.slice(0, -1));
      setCurrentNodeId(prevNodeId);
      onNodeSelect?.(prevNodeId);
    } else if (currentStepIndex > 0) {
      const prevNode = actionNodes[currentStepIndex - 1];
      if (prevNode) {
        setCurrentNodeId(prevNode.id);
        onNodeSelect?.(prevNode.id);
      }
    }
  };

  const handleNext = () => {
    if (currentNode) {
      const nextNode = findNextNode(currentNode.id);
      if (nextNode) {
        navigateToNode(nextNode.id);
      }
    }
  };

  const handleReset = useCallback(() => {
    setNavigationHistory([]);
    const firstNode = findFirstActionNode();
    if (firstNode) {
      setCurrentNodeId(firstNode.id);
      onNodeSelect?.(firstNode.id);
    } else {
      setCurrentNodeId(null);
    }
  }, [findFirstActionNode, onNodeSelect]);

  const getStepIcon = (node: FlowNode) => {
    const icone = node.data.icone as string || 'file-text';
    const Icon = ICON_MAP[icone] || FileText;
    return <Icon className="h-5 w-5" />;
  };

  const isCurrentNodeSelected = currentNode && currentNode.id === selectedNodeId;
  
  // Pegar os botões e layout diretamente do nó atual na lista de nodes (para ter dados atualizados)
  const currentNodeData = currentNode ? nodes.find(n => n.id === currentNode.id)?.data : null;
  const botoes = currentNodeData?.botoes || [];
  const layoutBotoes = currentNodeData?.layoutBotoes || 'vertical';

  // Estilos dinâmicos do card
  const getCardStyles = () => {
    if (!currentNodeData) return {};
    
    const styles: React.CSSProperties = {};
    
    if (currentNodeData.corFundo) {
      styles.backgroundColor = currentNodeData.fundoGradiente 
        ? `linear-gradient(135deg, ${currentNodeData.corFundo}, ${currentNodeData.cor || currentNodeData.corFundo})`
        : currentNodeData.corFundo;
      if (currentNodeData.fundoGradiente) {
        styles.background = `linear-gradient(135deg, ${currentNodeData.corFundo}, ${currentNodeData.cor || currentNodeData.corFundo})`;
      }
    }
    
    if (currentNodeData.corTexto) {
      styles.color = currentNodeData.corTexto;
    }
    
    return styles;
  };

  const getBorderRadius = () => {
    const borda = currentNodeData?.bordaArredondada;
    switch (borda) {
      case 'none': return 'rounded-none';
      case 'small': return 'rounded-md';
      case 'large': return 'rounded-2xl';
      default: return 'rounded-lg';
    }
  };

  const getShadow = () => {
    const sombra = currentNodeData?.sombra;
    switch (sombra) {
      case 'none': return 'shadow-none';
      case 'small': return 'shadow-sm';
      case 'large': return 'shadow-xl';
      default: return 'shadow-md';
    }
  };

  const getAnimation = () => {
    const anim = currentNodeData?.animacaoEntrada;
    switch (anim) {
      case 'slide': return 'animate-slide-in-right';
      case 'scale': return 'animate-scale-in';
      case 'none': return '';
      default: return 'animate-fade-in';
    }
  };

  const getButtonLayoutClasses = () => {
    switch (layoutBotoes) {
      case 'horizontal':
        return 'flex flex-row gap-2 flex-wrap';
      case 'grid':
        return 'grid grid-cols-2 gap-2';
      default:
        return 'flex flex-col gap-2';
    }
  };

  // Encontrar próximo nó para exibir
  const nextNode = currentNode ? findNextNode(currentNode.id) : null;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 flex-shrink-0">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>Preview do Onboarding</span>
          <Badge variant="outline" className="text-[10px]">
            {actionNodes.length} passos
          </Badge>
        </CardTitle>
        
        {/* Seletor de simulação */}
        <div className="flex gap-1 mt-2">
          <Button
            size="sm"
            variant={simulationType === 'assistencia' ? 'default' : 'outline'}
            className="flex-1 h-7 text-xs"
            onClick={() => {
              setSimulationType('assistencia');
              handleReset();
            }}
          >
            Assistência
          </Button>
          <Button
            size="sm"
            variant={simulationType === 'vendas' ? 'default' : 'outline'}
            className="flex-1 h-7 text-xs"
            onClick={() => {
              setSimulationType('vendas');
              handleReset();
            }}
          >
            Vendas
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-3 pt-0 overflow-hidden">
        {actionNodes.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm text-center">
            <p>Adicione nós do tipo "Ação" para visualizar o preview</p>
          </div>
        ) : (
          <>
            {/* Progresso */}
            <div className="mb-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Passo {currentStepIndex + 1} de {actionNodes.length}</span>
                <span>{Math.round(progressPercent)}%</span>
              </div>
              <Progress value={progressPercent} className="h-1.5" />
            </div>

            {/* Card do passo atual */}
            {currentNode && currentNodeData && (
              <div 
                key={`${currentNode.id}-${JSON.stringify(botoes)}`}
                className={cn(
                  "flex-1 border-2 p-4 transition-all cursor-pointer overflow-y-auto",
                  getBorderRadius(),
                  getShadow(),
                  getAnimation(),
                  isCurrentNodeSelected 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-primary/50"
                )}
                style={getCardStyles()}
                onClick={() => onNodeSelect?.(currentNode.id)}
              >
                {/* Badge opcional */}
                {currentNodeData.badgeTexto && (
                  <Badge 
                    className="mb-2 text-[10px]"
                    style={{ backgroundColor: currentNodeData.badgeCor || '#22c55e' }}
                  >
                    {currentNodeData.badgeTexto}
                  </Badge>
                )}

                <div className="flex items-start gap-3 mb-3">
                  <div 
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: `${currentNodeData.cor}20` }}
                  >
                    <div style={{ color: currentNodeData.cor }}>
                      {getStepIcon(currentNode)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm truncate">
                      {currentNodeData.label}
                    </h4>
                    {currentNodeData.subtitulo && (
                      <p className="text-xs text-muted-foreground">
                        {currentNodeData.subtitulo}
                      </p>
                    )}
                  </div>
                </div>

                {currentNodeData.descricao && (
                  <p className="text-xs text-muted-foreground mb-4 line-clamp-3">
                    {currentNodeData.descricao}
                  </p>
                )}

                {/* Renderizar botões dinâmicos */}
                {botoes.length > 0 ? (
                  <div className={cn("mt-4", getButtonLayoutClasses())}>
                    {botoes.map((botao) => (
                      <Button 
                        key={botao.id}
                        size="sm" 
                        className={cn(
                          "text-xs",
                          layoutBotoes === 'vertical' ? 'w-full' : ''
                        )}
                        variant={botao.estilo === 'primary' ? 'default' : 
                                botao.estilo === 'destructive' ? 'destructive' :
                                botao.estilo as 'secondary' | 'outline' | 'ghost'}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleButtonClick(botao);
                        }}
                      >
                        {botao.texto}
                      </Button>
                    ))}
                  </div>
                ) : currentNodeData.botaoTexto ? (
                  <Button 
                    size="sm" 
                    className="w-full h-8 text-xs"
                    variant={currentNodeData.estiloBotao === 'secondary' ? 'secondary' : 
                            currentNodeData.estiloBotao === 'outline' ? 'outline' :
                            currentNodeData.estiloBotao === 'ghost' ? 'ghost' : 'default'}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNext();
                    }}
                  >
                    {currentNodeData.botaoTexto}
                  </Button>
                ) : null}

                {currentNodeData.rota && (
                  <p className="text-[10px] text-muted-foreground mt-2 text-center">
                    Rota: {currentNodeData.rota}
                  </p>
                )}
              </div>
            )}

            {/* Próximo passo */}
            {nextNode && (
              <div className="mt-2 text-xs text-muted-foreground text-center">
                Próximo: {nextNode.data.label}
              </div>
            )}

            {/* Controles de navegação */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t">
              <Button
                size="sm"
                variant="ghost"
                onClick={handlePrev}
                disabled={currentStepIndex === 0 && navigationHistory.length === 0}
                className="h-7 text-xs"
              >
                <ChevronLeft className="h-3 w-3 mr-1" />
                Anterior
              </Button>
              
              <Button
                size="sm"
                variant="ghost"
                onClick={handleReset}
                className="h-7 text-xs"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
              
              <Button
                size="sm"
                variant="ghost"
                onClick={handleNext}
                disabled={!nextNode}
                className="h-7 text-xs"
              >
                Próximo
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
