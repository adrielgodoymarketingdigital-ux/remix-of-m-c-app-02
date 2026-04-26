import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Play,
  GitBranch,
  MousePointer,
  Flag,
  FileText,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Save,
  RotateCcw,
  Trash2
} from 'lucide-react';
import { NODE_COLORS } from './types';

interface FlowToolbarProps {
  onAddNode: (tipo: 'inicio' | 'decisao' | 'acao' | 'fim' | 'conteudo' | 'mensagem' | 'aguardar' | 'celebracao') => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onSave: () => void;
  onReset: () => void;
  onDeleteSelected: () => void;
  saving: boolean;
  hasChanges: boolean;
  hasSelection: boolean;
}

export function FlowToolbar({
  onAddNode,
  onZoomIn,
  onZoomOut,
  onFitView,
  onSave,
  onReset,
  onDeleteSelected,
  saving,
  hasChanges,
  hasSelection
}: FlowToolbarProps) {
  const nodeTypes = [
    { tipo: 'inicio' as const, icon: Play, label: 'Início', color: NODE_COLORS.inicio },
    { tipo: 'acao' as const, icon: MousePointer, label: 'Ação', color: NODE_COLORS.acao },
    { tipo: 'decisao' as const, icon: GitBranch, label: 'Decisão', color: NODE_COLORS.decisao },
    { tipo: 'conteudo' as const, icon: FileText, label: 'Conteúdo', color: NODE_COLORS.conteudo },
    { tipo: 'mensagem' as const, icon: FileText, label: 'Mensagem', color: NODE_COLORS.mensagem },
    { tipo: 'celebracao' as const, icon: Flag, label: 'Celebração', color: NODE_COLORS.celebracao },
    { tipo: 'fim' as const, icon: Flag, label: 'Fim', color: NODE_COLORS.fim },
  ];

  return (
    <Card className="absolute top-4 left-4 z-10 p-2 flex flex-wrap items-center gap-2 max-w-[calc(100%-2rem)]">
      {/* Botões de adicionar nó */}
      <div className="flex items-center gap-1">
        {nodeTypes.map(({ tipo, icon: Icon, label, color }) => (
          <Button
            key={tipo}
            variant="ghost"
            size="sm"
            onClick={() => onAddNode(tipo)}
            className="flex items-center gap-1.5 h-8"
            title={`Adicionar ${label}`}
          >
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: color }} 
            />
            <span className="hidden sm:inline text-xs">{label}</span>
          </Button>
        ))}
      </div>
      
      <Separator orientation="vertical" className="h-6" />
      
      {/* Controles de zoom */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={onZoomIn} className="h-8 w-8" title="Zoom In">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onZoomOut} className="h-8 w-8" title="Zoom Out">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onFitView} className="h-8 w-8" title="Ajustar Visualização">
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>
      
      <Separator orientation="vertical" className="h-6" />
      
      {/* Ações */}
      <div className="flex items-center gap-1">
        {hasSelection && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onDeleteSelected}
            className="h-8 w-8 text-destructive hover:text-destructive"
            title="Deletar Selecionado"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onReset} className="h-8" title="Restaurar Padrão">
          <RotateCcw className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline text-xs">Restaurar</span>
        </Button>
        <Button 
          size="sm" 
          onClick={onSave} 
          disabled={!hasChanges || saving}
          className="h-8"
        >
          <Save className="h-4 w-4 mr-1" />
          <span className="text-xs">{saving ? 'Salvando...' : 'Salvar'}</span>
        </Button>
      </div>
    </Card>
  );
}
