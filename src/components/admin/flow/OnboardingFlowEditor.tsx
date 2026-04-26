import { useState, useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type ReactFlowInstance,
  BackgroundVariant,
  MiniMap,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import FlowNodeComponent from './FlowNodeComponent';
import { FlowToolbar } from './FlowToolbar';
import { FlowNodeEditor } from './FlowNodeEditor';
import { OnboardingFlowPreview } from './OnboardingFlowPreview';
import type { FlowNode, FlowEdge, FlowNodeData, OnboardingFlowConfig, NODE_COLORS } from './types';

const nodeTypes = {
  default: FlowNodeComponent,
};

const DEFAULT_NODES: FlowNode[] = [
  {
    id: 'inicio',
    type: 'default',
    position: { x: 250, y: 50 },
    data: { 
      label: 'Início', 
      tipo: 'inicio', 
      cor: '#22c55e',
      icone: 'play',
      descricao: 'Início do onboarding'
    },
  },
  {
    id: 'decisao-tipo',
    type: 'default',
    position: { x: 250, y: 150 },
    data: { 
      label: 'Tipo de Negócio?', 
      tipo: 'decisao', 
      cor: '#eab308',
      icone: 'git-branch',
      condicao: 'tipo_negocio'
    },
  },
  {
    id: 'cliente',
    type: 'default',
    position: { x: 100, y: 280 },
    data: { 
      label: 'Cadastrar Cliente', 
      tipo: 'acao', 
      cor: '#3b82f6',
      icone: 'user',
      rota: '/clientes',
      botaoTexto: 'Cadastrar Cliente',
      descricao: 'Primeiro passo - cadastrar cliente'
    },
  },
  {
    id: 'peca',
    type: 'default',
    position: { x: 100, y: 400 },
    data: { 
      label: 'Cadastrar Peça', 
      tipo: 'acao', 
      cor: '#3b82f6',
      icone: 'package',
      rota: '/produtos',
      botaoTexto: 'Cadastrar Peça',
      descricao: 'Assistência - cadastrar peças'
    },
  },
  {
    id: 'dispositivo',
    type: 'default',
    position: { x: 400, y: 280 },
    data: { 
      label: 'Cadastrar Aparelho', 
      tipo: 'acao', 
      cor: '#3b82f6',
      icone: 'smartphone',
      rota: '/dispositivos',
      botaoTexto: 'Cadastrar Aparelho',
      descricao: 'Vendas - cadastrar dispositivo'
    },
  },
  {
    id: 'os',
    type: 'default',
    position: { x: 100, y: 520 },
    data: { 
      label: 'Criar OS', 
      tipo: 'acao', 
      cor: '#3b82f6',
      icone: 'clipboard-list',
      rota: '/ordem-servico',
      botaoTexto: 'Criar OS',
      descricao: 'Criar ordem de serviço'
    },
  },
  {
    id: 'lucro',
    type: 'default',
    position: { x: 250, y: 640 },
    data: { 
      label: 'Ver Lucro', 
      tipo: 'acao', 
      cor: '#3b82f6',
      icone: 'trending-up',
      rota: '/financeiro',
      botaoTexto: 'Ver Lucros',
      descricao: 'Visualizar lucros - Aha Moment!'
    },
  },
  {
    id: 'fim',
    type: 'default',
    position: { x: 250, y: 760 },
    data: { 
      label: 'Onboarding Completo', 
      tipo: 'fim', 
      cor: '#ef4444',
      icone: 'flag',
      descricao: 'Usuário completou o onboarding'
    },
  },
];

const DEFAULT_EDGES: FlowEdge[] = [
  { id: 'e-inicio-decisao', source: 'inicio', target: 'decisao-tipo', animated: true },
  { id: 'e-decisao-cliente-a', source: 'decisao-tipo', target: 'cliente', sourceHandle: 'left', label: 'Assistência' },
  { id: 'e-decisao-dispositivo', source: 'decisao-tipo', target: 'dispositivo', sourceHandle: 'right', label: 'Vendas' },
  { id: 'e-cliente-peca', source: 'cliente', target: 'peca' },
  { id: 'e-peca-os', source: 'peca', target: 'os' },
  { id: 'e-os-lucro', source: 'os', target: 'lucro' },
  { id: 'e-dispositivo-lucro', source: 'dispositivo', target: 'lucro' },
  { id: 'e-lucro-fim', source: 'lucro', target: 'fim', animated: true },
];

interface OnboardingFlowEditorProps {
  initialConfig?: OnboardingFlowConfig;
  onSave: (config: OnboardingFlowConfig) => Promise<void>;
  saving: boolean;
}

export function OnboardingFlowEditor({ initialConfig, onSave, saving }: OnboardingFlowEditorProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  
  const [nodes, setNodes] = useState<FlowNode[]>(
    initialConfig?.nodes?.length ? initialConfig.nodes : DEFAULT_NODES
  );
  const [edges, setEdges] = useState<FlowEdge[]>(
    initialConfig?.edges?.length ? initialConfig.edges : DEFAULT_EDGES
  );
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  // Atualizar quando initialConfig mudar
  useEffect(() => {
    if (initialConfig?.nodes?.length) {
      setNodes(initialConfig.nodes);
    }
    if (initialConfig?.edges?.length) {
      setEdges(initialConfig.edges);
    }
  }, [initialConfig]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds) as FlowNode[]);
    setHasChanges(true);
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
    setHasChanges(true);
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => addEdge({ 
      ...connection, 
      animated: false,
      style: { stroke: 'hsl(var(--primary))' }
    }, eds));
    setHasChanges(true);
  }, []);

  const onNodeClick = useCallback((_: React.MouseEvent, node: FlowNode) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleAddNode = useCallback((tipo: FlowNodeData['tipo']) => {
    const nodeColors: Record<string, string> = {
      inicio: '#22c55e',
      decisao: '#eab308',
      acao: '#3b82f6',
      fim: '#ef4444',
      conteudo: '#8b5cf6',
      mensagem: '#06b6d4',
      aguardar: '#f97316',
      celebracao: '#ec4899',
    };
    
    const nodeIcons: Record<string, string> = {
      inicio: 'play',
      decisao: 'git-branch',
      acao: 'mouse-pointer',
      fim: 'flag',
      conteudo: 'file-text',
      mensagem: 'message-circle',
      aguardar: 'clock',
      celebracao: 'party-popper',
    };

    const newNode: FlowNode = {
      id: `node_${Date.now()}`,
      type: 'default',
      position: {
        x: Math.random() * 300 + 100,
        y: Math.random() * 300 + 100,
      },
      data: {
        label: `Novo ${tipo}`,
        tipo,
        cor: nodeColors[tipo] || '#3b82f6',
        icone: nodeIcons[tipo] || 'file-text',
      },
    };
    setNodes((nds) => [...nds, newNode]);
    setHasChanges(true);
  }, []);

  const handleUpdateNode = useCallback((nodeId: string, data: Partial<FlowNodeData>) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...data } }
          : node
      )
    );
    // Atualizar nó selecionado se for o mesmo
    setSelectedNode((prev) => 
      prev?.id === nodeId 
        ? { ...prev, data: { ...prev.data, ...data } }
        : prev
    );
    setHasChanges(true);
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (selectedNode) {
      setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
      setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
      setSelectedNode(null);
      setHasChanges(true);
    }
  }, [selectedNode]);

  const handleZoomIn = useCallback(() => {
    reactFlowInstance?.zoomIn();
  }, [reactFlowInstance]);

  const handleZoomOut = useCallback(() => {
    reactFlowInstance?.zoomOut();
  }, [reactFlowInstance]);

  const handleFitView = useCallback(() => {
    reactFlowInstance?.fitView({ padding: 0.2 });
  }, [reactFlowInstance]);

  const handleReset = useCallback(() => {
    setNodes(DEFAULT_NODES);
    setEdges(DEFAULT_EDGES);
    setSelectedNode(null);
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(async () => {
    await onSave({
      nodes,
      edges,
      metadata: {
        nome: 'Fluxo de Onboarding',
        atualizado_em: new Date().toISOString(),
      },
    });
    setHasChanges(false);
  }, [nodes, edges, onSave]);

  const handlePreviewNodeSelect = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      setSelectedNode(node);
      // Centralizar no nó selecionado
      reactFlowInstance?.setCenter(
        node.position.x + 75,
        node.position.y + 50,
        { zoom: 1.2, duration: 500 }
      );
    }
  }, [nodes, reactFlowInstance]);

  return (
    <Card className="h-[700px] relative">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Editor Visual do Funil</span>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <span className="text-xs text-amber-600 font-normal">
                ⚠️ Alterações não salvas
              </span>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 h-[calc(100%-60px)]">
        <div className="flex h-full">
          {/* Editor Flow */}
          <div 
            ref={reactFlowWrapper} 
            className={`${showPreview ? 'w-2/3' : 'w-full'} h-full relative transition-all`}
          >
            <ReactFlow
              nodes={nodes as any}
              edges={edges}
              onNodesChange={onNodesChange as any}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick as any}
              onPaneClick={onPaneClick}
              onInit={setReactFlowInstance as any}
              nodeTypes={nodeTypes as any}
              fitView
              snapToGrid
              snapGrid={[15, 15]}
              defaultEdgeOptions={{
                style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 },
                type: 'smoothstep',
              }}
              className="bg-background"
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
              <Controls className="!bg-background !border-border" />
              <MiniMap 
                className="!bg-background !border-border"
                nodeColor={(node) => {
                  const data = node.data as FlowNodeData;
                  switch (data.tipo) {
                    case 'inicio': return '#22c55e';
                    case 'decisao': return '#eab308';
                    case 'acao': return '#3b82f6';
                    case 'fim': return '#ef4444';
                    case 'conteudo': return '#8b5cf6';
                    case 'mensagem': return '#06b6d4';
                    case 'aguardar': return '#f97316';
                    case 'celebracao': return '#ec4899';
                    default: return '#888';
                  }
                }}
              />
            </ReactFlow>
            
            <FlowToolbar
              onAddNode={handleAddNode}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onFitView={handleFitView}
              onSave={handleSave}
              onReset={handleReset}
              onDeleteSelected={handleDeleteSelected}
              saving={saving}
              hasChanges={hasChanges}
              hasSelection={!!selectedNode}
            />
            
            <FlowNodeEditor
              node={selectedNode}
              nodes={nodes}
              onUpdate={handleUpdateNode}
              onClose={() => setSelectedNode(null)}
            />
          </div>

          {/* Preview Panel */}
          {showPreview && (
            <div className="w-1/3 h-full border-l">
              <OnboardingFlowPreview
                nodes={nodes}
                edges={edges}
                selectedNodeId={selectedNode?.id}
                onNodeSelect={handlePreviewNodeSelect}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}