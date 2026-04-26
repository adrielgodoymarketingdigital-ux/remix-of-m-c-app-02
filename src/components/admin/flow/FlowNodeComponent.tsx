import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FlowNode } from './types';
import { 
  Play, 
  GitBranch, 
  MousePointer, 
  Flag, 
  FileText,
  User,
  Package,
  ClipboardList,
  TrendingUp,
  Smartphone,
  MessageCircle,
  Clock,
  PartyPopper,
  Layers,
} from 'lucide-react';

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

function FlowNodeComponent({ data, selected }: NodeProps<FlowNode>) {
  const icone = data.icone as string | undefined;
  const IconComponent = icone ? ICON_MAP[icone] || FileText : FileText;
  const tipo = data.tipo as string;
  const label = data.label as string;
  const descricao = data.descricao as string | undefined;
  const botoes = data.botoes as Array<{ id: string; texto: string }> | undefined;
  const hasBotoes = botoes && botoes.length > 0;
  
  const getNodeStyles = () => {
    const baseStyles = "px-4 py-3 rounded-lg border-2 min-w-[140px] max-w-[200px] shadow-md transition-all";
    
    if (tipo === 'decisao') {
      return `${baseStyles} rotate-0`;
    }
    
    return baseStyles;
  };
  
  const getBorderColor = () => {
    if (selected) return 'border-primary';
    return 'border-transparent';
  };
  
  const getBackgroundColor = () => {
    switch (tipo) {
      case 'inicio':
        return 'bg-green-100 dark:bg-green-900/50';
      case 'decisao':
        return 'bg-yellow-100 dark:bg-yellow-900/50';
      case 'acao':
        return 'bg-blue-100 dark:bg-blue-900/50';
      case 'fim':
        return 'bg-red-100 dark:bg-red-900/50';
      case 'conteudo':
        return 'bg-violet-100 dark:bg-violet-900/50';
      case 'mensagem':
        return 'bg-cyan-100 dark:bg-cyan-900/50';
      case 'aguardar':
        return 'bg-orange-100 dark:bg-orange-900/50';
      case 'celebracao':
        return 'bg-pink-100 dark:bg-pink-900/50';
      default:
        return 'bg-muted';
    }
  };
  
  const getTextColor = () => {
    switch (tipo) {
      case 'inicio':
        return 'text-green-700 dark:text-green-300';
      case 'decisao':
        return 'text-yellow-700 dark:text-yellow-300';
      case 'acao':
        return 'text-blue-700 dark:text-blue-300';
      case 'fim':
        return 'text-red-700 dark:text-red-300';
      case 'conteudo':
        return 'text-violet-700 dark:text-violet-300';
      case 'mensagem':
        return 'text-cyan-700 dark:text-cyan-300';
      case 'aguardar':
        return 'text-orange-700 dark:text-orange-300';
      case 'celebracao':
        return 'text-pink-700 dark:text-pink-300';
      default:
        return 'text-foreground';
    }
  };
  
  const getIconBgColor = () => {
    switch (tipo) {
      case 'inicio':
        return 'bg-green-200 dark:bg-green-800';
      case 'decisao':
        return 'bg-yellow-200 dark:bg-yellow-800';
      case 'acao':
        return 'bg-blue-200 dark:bg-blue-800';
      case 'fim':
        return 'bg-red-200 dark:bg-red-800';
      case 'conteudo':
        return 'bg-violet-200 dark:bg-violet-800';
      case 'mensagem':
        return 'bg-cyan-200 dark:bg-cyan-800';
      case 'aguardar':
        return 'bg-orange-200 dark:bg-orange-800';
      case 'celebracao':
        return 'bg-pink-200 dark:bg-pink-800';
      default:
        return 'bg-muted';
    }
  };

  return (
    <div className={`${getNodeStyles()} ${getBackgroundColor()} ${getBorderColor()}`}>
      {/* Handles para conexões */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-primary !border-2 !border-background"
      />
      
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-md ${getIconBgColor()}`}>
          <IconComponent className={`h-4 w-4 ${getTextColor()}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className={`text-sm font-medium truncate ${getTextColor()}`}>
              {label}
            </p>
            {/* Indicador de múltiplos botões */}
            {hasBotoes && (
              <div className="flex items-center gap-0.5" title={`${botoes.length} botões configurados`}>
                <Layers className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">{botoes.length}</span>
              </div>
            )}
          </div>
          {descricao && (
            <p className="text-xs text-muted-foreground truncate">
              {descricao}
            </p>
          )}
        </div>
      </div>
      
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-primary !border-2 !border-background"
      />
      
      {/* Handle lateral para decisões */}
      {tipo === 'decisao' && (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="right"
            className="!w-3 !h-3 !bg-yellow-500 !border-2 !border-background"
          />
          <Handle
            type="source"
            position={Position.Left}
            id="left"
            className="!w-3 !h-3 !bg-yellow-500 !border-2 !border-background"
          />
        </>
      )}
    </div>
  );
}

export default memo(FlowNodeComponent);