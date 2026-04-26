import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Palette, Type, Navigation, Plus, MousePointer, Sparkles } from 'lucide-react';
import type { FlowNode, FlowNodeData, BotaoAcao } from './types';
import { 
  ESTILOS_BOTAO, 
  BORDA_OPTIONS, 
  SOMBRA_OPTIONS, 
  ANIMACAO_OPTIONS,
  LAYOUT_BOTOES_OPTIONS 
} from './types';
import { ROTAS_DISPONIVEIS, ICONES_DISPONIVEIS } from '@/types/onboarding-config';
import { BotaoAcaoEditor } from './BotaoAcaoEditor';

interface FlowNodeEditorProps {
  node: FlowNode | null;
  nodes: FlowNode[];
  onUpdate: (nodeId: string, data: Partial<FlowNodeData>) => void;
  onClose: () => void;
}

const TIPO_OPTIONS = [
  { value: 'inicio', label: 'Início' },
  { value: 'acao', label: 'Ação' },
  { value: 'decisao', label: 'Decisão' },
  { value: 'conteudo', label: 'Conteúdo' },
  { value: 'mensagem', label: 'Mensagem' },
  { value: 'aguardar', label: 'Aguardar' },
  { value: 'celebracao', label: 'Celebração' },
  { value: 'fim', label: 'Fim' },
];

const ESTILO_CARD_OPTIONS = [
  { value: 'padrao', label: 'Padrão' },
  { value: 'destaque', label: 'Destaque' },
  { value: 'minimo', label: 'Mínimo' },
];

const TAMANHO_OPTIONS = [
  { value: 'pequeno', label: 'Pequeno' },
  { value: 'normal', label: 'Normal' },
  { value: 'grande', label: 'Grande' },
];

const COR_OPTIONS = [
  { value: '#22c55e', label: 'Verde' },
  { value: '#3b82f6', label: 'Azul' },
  { value: '#eab308', label: 'Amarelo' },
  { value: '#ef4444', label: 'Vermelho' },
  { value: '#8b5cf6', label: 'Roxo' },
  { value: '#06b6d4', label: 'Ciano' },
  { value: '#f97316', label: 'Laranja' },
  { value: '#ec4899', label: 'Rosa' },
  { value: '#64748b', label: 'Cinza' },
  { value: '#1e293b', label: 'Escuro' },
];

export function FlowNodeEditor({ node, nodes, onUpdate, onClose }: FlowNodeEditorProps) {
  const [localData, setLocalData] = useState<FlowNodeData | null>(null);

  useEffect(() => {
    if (node) {
      setLocalData(node.data);
    }
  }, [node]);

  if (!node || !localData) return null;

  const handleChange = (field: keyof FlowNodeData, value: unknown) => {
    const newData = { ...localData, [field]: value };
    setLocalData(newData as FlowNodeData);
    onUpdate(node.id, { [field]: value });
  };

  const isActionType = ['acao', 'conteudo', 'mensagem', 'aguardar', 'celebracao'].includes(localData.tipo);

  // Gerenciamento de botões
  const botoes = localData.botoes || [];

  const addBotao = () => {
    const novoBotao: BotaoAcao = {
      id: `btn-${Date.now()}`,
      texto: 'Novo botão',
      estilo: 'primary',
    };
    handleChange('botoes', [...botoes, novoBotao]);
  };

  const updateBotao = (index: number, botao: BotaoAcao) => {
    const novosBotoes = [...botoes];
    novosBotoes[index] = botao;
    handleChange('botoes', novosBotoes);
  };

  const removeBotao = (index: number) => {
    const novosBotoes = botoes.filter((_, i) => i !== index);
    handleChange('botoes', novosBotoes);
  };

  const duplicateBotao = (index: number) => {
    const novosBotoes = [...botoes];
    const copia = { ...botoes[index], id: `btn-${Date.now()}` };
    novosBotoes.splice(index + 1, 0, copia);
    handleChange('botoes', novosBotoes);
  };

  const moveBotao = (index: number, direction: 'up' | 'down') => {
    const novosBotoes = [...botoes];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [novosBotoes[index], novosBotoes[newIndex]] = [novosBotoes[newIndex], novosBotoes[index]];
    handleChange('botoes', novosBotoes);
  };

  return (
    <Card className="absolute top-4 right-4 z-10 w-96 max-h-[calc(100%-2rem)] flex flex-col shadow-lg">
      <CardHeader className="pb-2 flex-shrink-0 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Editar Nó</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-6 w-6">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <Tabs defaultValue="conteudo" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-4 mt-2 grid grid-cols-3">
          <TabsTrigger value="conteudo" className="text-xs">
            <Type className="h-3 w-3 mr-1" />
            Conteúdo
          </TabsTrigger>
          <TabsTrigger value="botoes" className="text-xs">
            <MousePointer className="h-3 w-3 mr-1" />
            Botões
          </TabsTrigger>
          <TabsTrigger value="estilo" className="text-xs">
            <Sparkles className="h-3 w-3 mr-1" />
            Estilo
          </TabsTrigger>
        </TabsList>
        
        <ScrollArea className="flex-1 overflow-hidden">
          {/* Tab Conteúdo */}
          <TabsContent value="conteudo" className="m-0 p-4 space-y-4">
            {/* Tipo */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Tipo</Label>
              <Select 
                value={localData.tipo} 
                onValueChange={(v) => handleChange('tipo', v as FlowNodeData['tipo'])}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-50">
                  {TIPO_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Conteúdo */}
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-xs">Nome</Label>
                <Input
                  value={localData.label}
                  onChange={(e) => handleChange('label', e.target.value)}
                  placeholder="Nome do nó"
                  className="h-8 text-xs"
                />
              </div>

              {isActionType && (
                <div className="space-y-2">
                  <Label className="text-xs">Subtítulo</Label>
                  <Input
                    value={localData.subtitulo || ''}
                    onChange={(e) => handleChange('subtitulo', e.target.value)}
                    placeholder="Subtítulo opcional"
                    className="h-8 text-xs"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs">Descrição</Label>
                <Textarea
                  value={localData.descricao || ''}
                  onChange={(e) => handleChange('descricao', e.target.value)}
                  placeholder="Descrição do passo"
                  rows={3}
                  className="text-xs resize-none"
                />
              </div>

              {isActionType && (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs">Ícone</Label>
                    <Select 
                      value={localData.icone || 'file-text'} 
                      onValueChange={(v) => handleChange('icone', v)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-50 max-h-48">
                        {ICONES_DISPONIVEIS.map(icone => (
                          <SelectItem key={icone} value={icone} className="text-xs">
                            {icone}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Rota de navegação</Label>
                    <Select 
                      value={localData.rota || '/dashboard'} 
                      onValueChange={(v) => handleChange('rota', v)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-50 max-h-48">
                        {ROTAS_DISPONIVEIS.map(rota => (
                          <SelectItem key={rota.value} value={rota.value} className="text-xs">
                            {rota.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {localData.tipo === 'decisao' && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Condição</Label>
                    <Input
                      value={localData.condicao || ''}
                      onChange={(e) => handleChange('condicao', e.target.value)}
                      placeholder="Ex: tipo_negocio"
                      className="h-8 text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      • Saída ESQUERDA = Assistência<br/>
                      • Saída DIREITA = Vendas<br/>
                      • Saída INFERIOR = Padrão
                    </p>
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          {/* Tab Botões */}
          <TabsContent value="botoes" className="m-0 p-4 space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Botões de Ação</Label>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7 text-xs"
                  onClick={addBotao}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Adicionar
                </Button>
              </div>

              {botoes.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground border-2 border-dashed rounded-lg">
                  <MousePointer className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhum botão configurado</p>
                  <p className="text-[10px]">Clique em "Adicionar" para criar botões</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {botoes.map((botao, index) => (
                    <BotaoAcaoEditor
                      key={botao.id}
                      botao={botao}
                      nodes={nodes}
                      currentNodeId={node.id}
                      onChange={(b) => updateBotao(index, b)}
                      onRemove={() => removeBotao(index)}
                      onDuplicate={() => duplicateBotao(index)}
                      onMoveUp={() => moveBotao(index, 'up')}
                      onMoveDown={() => moveBotao(index, 'down')}
                      isFirst={index === 0}
                      isLast={index === botoes.length - 1}
                    />
                  ))}
                </div>
              )}

              {botoes.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="text-xs">Layout dos Botões</Label>
                    <Select 
                      value={localData.layoutBotoes || 'vertical'} 
                      onValueChange={(v) => handleChange('layoutBotoes', v)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-50">
                        {LAYOUT_BOTOES_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Mostrar botão principal separado</Label>
                    <Switch
                      checked={localData.mostrarBotaoPrincipal || false}
                      onCheckedChange={(v) => handleChange('mostrarBotaoPrincipal', v)}
                    />
                  </div>

                  {/* Botão principal separado */}
                  {localData.mostrarBotaoPrincipal && (
                    <div className="space-y-2">
                      <Label className="text-xs">Texto do Botão Principal</Label>
                      <Input
                        value={localData.botaoTexto || ''}
                        onChange={(e) => handleChange('botaoTexto', e.target.value)}
                        placeholder="Texto do botão principal"
                        className="h-8 text-xs"
                      />
                    </div>
                  )}
                </>
              )}

              {/* Fallback se não tiver botões dinâmicos */}
              {botoes.length === 0 && isActionType && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="text-xs">Texto do Botão (simples)</Label>
                    <Input
                      value={localData.botaoTexto || ''}
                      onChange={(e) => handleChange('botaoTexto', e.target.value)}
                      placeholder="Texto do botão"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Estilo do Botão</Label>
                    <Select 
                      value={localData.estiloBotao || 'primary'} 
                      onValueChange={(v) => handleChange('estiloBotao', v)}
                    >
                      <SelectTrigger className="h-8 text-xs">
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
                </>
              )}
            </div>
          </TabsContent>

          {/* Tab Estilo */}
          <TabsContent value="estilo" className="m-0 p-4 space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Palette className="h-3 w-3" />
                CORES
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Cor do Card</Label>
                <Select 
                  value={localData.cor || '#3b82f6'} 
                  onValueChange={(v) => handleChange('cor', v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: localData.cor || '#3b82f6' }}
                      />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="z-50">
                    {COR_OPTIONS.map(cor => (
                      <SelectItem key={cor.value} value={cor.value} className="text-xs">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: cor.value }}
                          />
                          {cor.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label className="text-xs">Cor de Fundo</Label>
                  <Select 
                    value={localData.corFundo || 'auto'} 
                    onValueChange={(v) => handleChange('corFundo', v === 'auto' ? undefined : v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Automático" />
                    </SelectTrigger>
                    <SelectContent className="z-50">
                      <SelectItem value="auto" className="text-xs">Automático</SelectItem>
                      {COR_OPTIONS.map(cor => (
                        <SelectItem key={cor.value} value={cor.value} className="text-xs">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full flex-shrink-0" 
                              style={{ backgroundColor: cor.value }}
                            />
                            {cor.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Cor do Texto</Label>
                  <Select 
                    value={localData.corTexto || 'auto'} 
                    onValueChange={(v) => handleChange('corTexto', v === 'auto' ? undefined : v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Automático" />
                    </SelectTrigger>
                    <SelectContent className="z-50">
                      <SelectItem value="auto" className="text-xs">Automático</SelectItem>
                      {COR_OPTIONS.map(cor => (
                        <SelectItem key={cor.value} value={cor.value} className="text-xs">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full flex-shrink-0" 
                              style={{ backgroundColor: cor.value }}
                            />
                            {cor.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs">Fundo com gradiente</Label>
                <Switch
                  checked={localData.fundoGradiente || false}
                  onCheckedChange={(v) => handleChange('fundoGradiente', v)}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                APARÊNCIA
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label className="text-xs">Borda</Label>
                  <Select 
                    value={localData.bordaArredondada || 'medium'} 
                    onValueChange={(v) => handleChange('bordaArredondada', v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-50">
                      {BORDA_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Sombra</Label>
                  <Select 
                    value={localData.sombra || 'medium'} 
                    onValueChange={(v) => handleChange('sombra', v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-50">
                      {SOMBRA_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label className="text-xs">Animação</Label>
                  <Select 
                    value={localData.animacaoEntrada || 'fade'} 
                    onValueChange={(v) => handleChange('animacaoEntrada', v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-50">
                      {ANIMACAO_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Tamanho</Label>
                  <Select 
                    value={localData.tamanho || 'normal'} 
                    onValueChange={(v) => handleChange('tamanho', v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-50">
                      {TAMANHO_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                BADGE (opcional)
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label className="text-xs">Texto do Badge</Label>
                  <Input
                    value={localData.badgeTexto || ''}
                    onChange={(e) => handleChange('badgeTexto', e.target.value)}
                    placeholder="Ex: Novo!"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Cor do Badge</Label>
                  <Select 
                    value={localData.badgeCor || '#22c55e'} 
                    onValueChange={(v) => handleChange('badgeCor', v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: localData.badgeCor || '#22c55e' }}
                        />
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="z-50">
                      {COR_OPTIONS.map(cor => (
                        <SelectItem key={cor.value} value={cor.value} className="text-xs">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full flex-shrink-0" 
                              style={{ backgroundColor: cor.value }}
                            />
                            {cor.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </Card>
  );
}
