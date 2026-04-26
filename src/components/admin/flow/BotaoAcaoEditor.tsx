import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, GripVertical, Copy, ChevronUp, ChevronDown } from 'lucide-react';
import type { BotaoAcao, FlowNode } from './types';
import { ESTILOS_BOTAO } from './types';
import { ROTAS_DISPONIVEIS, ICONES_DISPONIVEIS } from '@/types/onboarding-config';

interface BotaoAcaoEditorProps {
  botao: BotaoAcao;
  nodes: FlowNode[];
  currentNodeId: string;
  onChange: (botao: BotaoAcao) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

// Ações especiais que não são nós
const ACOES_ESPECIAIS = [
  { value: '__proximo__', label: 'Próximo passo (automático)' },
  { value: '__pular__', label: 'Pular onboarding' },
  { value: '__fechar__', label: 'Fechar modal' },
];

export function BotaoAcaoEditor({
  botao,
  nodes,
  currentNodeId,
  onChange,
  onRemove,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: BotaoAcaoEditorProps) {
  const handleChange = (field: keyof BotaoAcao, value: string) => {
    onChange({ ...botao, [field]: value });
  };

  const handleDestinoChange = (value: string) => {
    // Verificar se é uma rota do sistema
    const isRota = ROTAS_DISPONIVEIS.some(r => r.value === value);
    const isEspecial = ACOES_ESPECIAIS.some(a => a.value === value);
    
    if (isRota || isEspecial) {
      onChange({ ...botao, rota: value, destinoNodeId: undefined });
    } else {
      onChange({ ...botao, destinoNodeId: value, rota: undefined });
    }
  };

  // Filtrar nós disponíveis (excluir o nó atual)
  const nosDisponiveis = nodes.filter(n => 
    n.id !== currentNodeId && 
    ['acao', 'conteudo', 'mensagem', 'aguardar', 'celebracao', 'fim'].includes(n.data.tipo)
  );

  // Valor atual do destino
  const destinoAtual = botao.destinoNodeId || botao.rota || '__proximo__';

  return (
    <Card className="border bg-muted/30">
      <CardContent className="p-3 space-y-3">
        {/* Header com ações */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
            <span className="text-xs font-medium">Botão</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onMoveUp}
              disabled={isFirst}
            >
              <ChevronUp className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onMoveDown}
              disabled={isLast}
            >
              <ChevronDown className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onDuplicate}
            >
              <Copy className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={onRemove}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Texto do botão */}
        <div className="space-y-1">
          <Label className="text-xs">Texto</Label>
          <Input
            value={botao.texto}
            onChange={(e) => handleChange('texto', e.target.value)}
            placeholder="Ex: Sim, vamos lá!"
            className="h-7 text-xs"
          />
        </div>

        {/* Estilo e Ícone */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Estilo</Label>
            <Select 
              value={botao.estilo} 
              onValueChange={(v) => handleChange('estilo', v as BotaoAcao['estilo'])}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-50">
                {ESTILOS_BOTAO.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Ícone (opcional)</Label>
            <Select 
              value={botao.icone || 'none'} 
              onValueChange={(v) => handleChange('icone', v === 'none' ? '' : v)}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Nenhum" />
              </SelectTrigger>
              <SelectContent className="z-50 max-h-48">
                <SelectItem value="none" className="text-xs">Nenhum</SelectItem>
                {ICONES_DISPONIVEIS.map(icone => (
                  <SelectItem key={icone} value={icone} className="text-xs">
                    {icone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Destino */}
        <div className="space-y-1">
          <Label className="text-xs">Destino ao clicar</Label>
          <Select 
            value={destinoAtual} 
            onValueChange={handleDestinoChange}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="Selecione o destino" />
            </SelectTrigger>
            <SelectContent className="z-50 max-h-60">
              {/* Ações especiais */}
              <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground">
                ⏭️ AÇÕES ESPECIAIS
              </div>
              {ACOES_ESPECIAIS.map(acao => (
                <SelectItem key={acao.value} value={acao.value} className="text-xs">
                  {acao.label}
                </SelectItem>
              ))}
              
              {/* Nós do fluxo */}
              {nosDisponiveis.length > 0 && (
                <>
                  <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground mt-1">
                    📍 NÓS DO FLUXO
                  </div>
                  {nosDisponiveis.map(node => (
                    <SelectItem key={node.id} value={node.id} className="text-xs">
                      {node.data.label}
                    </SelectItem>
                  ))}
                </>
              )}
              
              {/* Rotas do sistema */}
              <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground mt-1">
                🔗 ROTAS DO SISTEMA
              </div>
              {ROTAS_DISPONIVEIS.map(rota => (
                <SelectItem key={rota.value} value={rota.value} className="text-xs">
                  {rota.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
