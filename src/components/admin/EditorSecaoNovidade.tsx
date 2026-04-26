import { useState } from "react";
import { 
  SecaoNovidade, 
  TipoSecao,
  SecaoBannerConfig,
  SecaoVideoConfig,
  SecaoImagemConfig,
  SecaoCardConfig,
  SecaoTextoConfig,
  SecaoGridConfig,
  EstiloSecao,
  EstiloTextoCard
} from "@/types/novidade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { Trash2, GripVertical, Image as ImageIcon, Video, FileText, LayoutGrid, Layers, Type, Upload, Palette, ChevronDown } from "lucide-react";

interface EditorSecaoNovidadeProps {
  secao: SecaoNovidade;
  onUpdate: (secao: SecaoNovidade) => void;
  onRemove: () => void;
  onUploadImage: (file: File) => Promise<string>;
}

const tipoIcons: Record<TipoSecao, React.ReactNode> = {
  banner: <Layers className="h-4 w-4" />,
  video: <Video className="h-4 w-4" />,
  imagem: <ImageIcon className="h-4 w-4" />,
  card: <FileText className="h-4 w-4" />,
  texto: <Type className="h-4 w-4" />,
  grid: <LayoutGrid className="h-4 w-4" />,
};

const tipoLabels: Record<TipoSecao, string> = {
  banner: 'Banner',
  video: 'Vídeo',
  imagem: 'Imagem',
  card: 'Card',
  texto: 'Texto',
  grid: 'Grid',
};

export function EditorSecaoNovidade({ secao, onUpdate, onRemove, onUploadImage }: EditorSecaoNovidadeProps) {
  const [uploading, setUploading] = useState(false);
  const [estiloOpen, setEstiloOpen] = useState(false);

  const handleConfigChange = (key: string, value: any) => {
    onUpdate({
      ...secao,
      config: { ...secao.config, [key]: value }
    });
  };

  const handleEstiloChange = (key: keyof EstiloSecao, value: any) => {
    onUpdate({
      ...secao,
      estilo: { ...secao.estilo, [key]: value }
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, configKey: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await onUploadImage(file);
      handleConfigChange(configKey, url);
    } catch (error) {
      console.error('Erro no upload:', error);
    } finally {
      setUploading(false);
    }
  };

  const renderEstiloFields = () => {
    const estilo = secao.estilo || {};
    
    return (
      <div className="space-y-4 pt-2">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Tamanho da Seção</Label>
            <Select 
              value={estilo.tamanho || 'auto'} 
              onValueChange={(v) => handleEstiloChange('tamanho', v)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automático</SelectItem>
                <SelectItem value="pequeno">Pequeno</SelectItem>
                <SelectItem value="medio">Médio</SelectItem>
                <SelectItem value="grande">Grande</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tamanho do Texto</Label>
            <Select 
              value={estilo.tamanhoTexto || 'base'} 
              onValueChange={(v) => handleEstiloChange('tamanhoTexto', v)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="xs">Extra Pequeno</SelectItem>
                <SelectItem value="sm">Pequeno</SelectItem>
                <SelectItem value="base">Normal</SelectItem>
                <SelectItem value="lg">Grande</SelectItem>
                <SelectItem value="xl">Extra Grande</SelectItem>
                <SelectItem value="2xl">2x Grande</SelectItem>
                <SelectItem value="3xl">3x Grande</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Cor de Fundo</Label>
            <div className="flex gap-2 mt-1">
              <Input 
                type="color"
                value={estilo.corFundo || '#ffffff'} 
                onChange={(e) => handleEstiloChange('corFundo', e.target.value)}
                className="w-10 h-8 p-1 cursor-pointer"
              />
              <Input 
                value={estilo.corFundo || ''} 
                onChange={(e) => handleEstiloChange('corFundo', e.target.value)}
                placeholder="Transparente"
                className="h-8 text-xs flex-1"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Cor do Texto</Label>
            <div className="flex gap-2 mt-1">
              <Input 
                type="color"
                value={estilo.corTexto || '#000000'} 
                onChange={(e) => handleEstiloChange('corTexto', e.target.value)}
                className="w-10 h-8 p-1 cursor-pointer"
              />
              <Input 
                value={estilo.corTexto || ''} 
                onChange={(e) => handleEstiloChange('corTexto', e.target.value)}
                placeholder="Padrão"
                className="h-8 text-xs flex-1"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Fonte</Label>
            <Select 
              value={estilo.fonte || 'default'} 
              onValueChange={(v) => handleEstiloChange('fonte', v)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Padrão (Sans-Serif)</SelectItem>
                <SelectItem value="serif">Serif</SelectItem>
                <SelectItem value="mono">Monospace</SelectItem>
                <SelectItem value="display">Display</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Espaçamento Interno</Label>
            <Select 
              value={estilo.padding || 'md'} 
              onValueChange={(v) => handleEstiloChange('padding', v)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                <SelectItem value="sm">Pequeno</SelectItem>
                <SelectItem value="md">Médio</SelectItem>
                <SelectItem value="lg">Grande</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="text-xs">Bordas Arredondadas</Label>
          <Select 
            value={estilo.borderRadius || 'md'} 
            onValueChange={(v) => handleEstiloChange('borderRadius', v)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem arredondamento</SelectItem>
              <SelectItem value="sm">Pequeno</SelectItem>
              <SelectItem value="md">Médio</SelectItem>
              <SelectItem value="lg">Grande</SelectItem>
              <SelectItem value="full">Completo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  };

  const renderConfigFields = () => {
    switch (secao.tipo) {
      case 'banner':
        const bannerConfig = secao.config as SecaoBannerConfig;
        return (
          <div className="space-y-4">
            <div>
              <Label>Imagem do Banner</Label>
              <div className="flex gap-2 mt-1">
                <Input 
                  value={bannerConfig.imagem_url || ''} 
                  onChange={(e) => handleConfigChange('imagem_url', e.target.value)}
                  placeholder="URL da imagem"
                />
                <Button variant="outline" size="icon" asChild disabled={uploading}>
                  <label className="cursor-pointer">
                    <Upload className="h-4 w-4" />
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, 'imagem_url')}
                    />
                  </label>
                </Button>
              </div>
            </div>
            <div>
              <Label>Link (opcional)</Label>
              <Input 
                value={bannerConfig.link_url || ''} 
                onChange={(e) => handleConfigChange('link_url', e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Largura</Label>
                <Select 
                  value={bannerConfig.largura || 'full'} 
                  onValueChange={(v) => handleConfigChange('largura', v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Largura Total</SelectItem>
                    <SelectItem value="half">Metade</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Altura</Label>
                <Select 
                  value={bannerConfig.altura || 'medium'} 
                  onValueChange={(v) => handleConfigChange('altura', v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Pequena</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="large">Grande</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );

      case 'video':
        const videoConfig = secao.config as SecaoVideoConfig;
        return (
          <div className="space-y-4">
            <div>
              <Label>URL do Vídeo</Label>
              <div className="flex gap-2 mt-1">
                <Input 
                  value={videoConfig.video_url || ''} 
                  onChange={(e) => handleConfigChange('video_url', e.target.value)}
                  placeholder="YouTube, Vimeo ou URL direta do vídeo"
                />
                <Button variant="outline" size="icon" asChild disabled={uploading}>
                  <label className="cursor-pointer">
                    <Upload className="h-4 w-4" />
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="video/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploading(true);
                        try {
                          const url = await onUploadImage(file);
                          handleConfigChange('video_url', url);
                        } finally {
                          setUploading(false);
                        }
                      }}
                    />
                  </label>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Cole um link do YouTube/Vimeo ou faça upload de um arquivo de vídeo
              </p>
            </div>
            <div>
              <Label>Título (opcional)</Label>
              <Input 
                value={videoConfig.titulo || ''} 
                onChange={(e) => handleConfigChange('titulo', e.target.value)}
              />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea 
                value={videoConfig.descricao || ''} 
                onChange={(e) => handleConfigChange('descricao', e.target.value)}
              />
            </div>
          </div>
        );

      case 'imagem':
        const imagemConfig = secao.config as SecaoImagemConfig;
        return (
          <div className="space-y-4">
            <div>
              <Label>Imagem</Label>
              <div className="flex gap-2 mt-1">
                <Input 
                  value={imagemConfig.imagem_url || ''} 
                  onChange={(e) => handleConfigChange('imagem_url', e.target.value)}
                  placeholder="URL da imagem"
                />
                <Button variant="outline" size="icon" asChild disabled={uploading}>
                  <label className="cursor-pointer">
                    <Upload className="h-4 w-4" />
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, 'imagem_url')}
                    />
                  </label>
                </Button>
              </div>
            </div>
            <div>
              <Label>Legenda (opcional)</Label>
              <Input 
                value={imagemConfig.legenda || ''} 
                onChange={(e) => handleConfigChange('legenda', e.target.value)}
              />
            </div>
            <div>
              <Label>Posição</Label>
              <Select 
                value={imagemConfig.posicao || 'center'} 
                onValueChange={(v) => handleConfigChange('posicao', v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Esquerda</SelectItem>
                  <SelectItem value="center">Centro</SelectItem>
                  <SelectItem value="right">Direita</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'card':
        const cardConfig = secao.config as SecaoCardConfig;
        
        const renderEstiloTextoEditor = (
          label: string,
          estiloKey: 'estiloTitulo' | 'estiloDescricao' | 'estiloBotao',
          estiloAtual?: EstiloTextoCard
        ) => (
          <Collapsible className="border rounded-lg p-3 bg-muted/30">
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <span className="text-xs font-medium flex items-center gap-2">
                <Palette className="h-3 w-3" />
                Estilo do {label}
              </span>
              <ChevronDown className="h-4 w-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Cor do Texto</Label>
                  <div className="flex gap-2 mt-1">
                    <Input 
                      type="color"
                      value={estiloAtual?.corTexto || '#000000'} 
                      onChange={(e) => handleConfigChange(estiloKey, { ...estiloAtual, corTexto: e.target.value })}
                      className="w-10 h-8 p-1 cursor-pointer"
                    />
                    <Input 
                      value={estiloAtual?.corTexto || ''} 
                      onChange={(e) => handleConfigChange(estiloKey, { ...estiloAtual, corTexto: e.target.value })}
                      placeholder="Padrão"
                      className="h-8 text-xs flex-1"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Tamanho</Label>
                  <Select 
                    value={estiloAtual?.tamanhoTexto || 'base'} 
                    onValueChange={(v) => handleConfigChange(estiloKey, { ...estiloAtual, tamanhoTexto: v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="xs">Extra Pequeno</SelectItem>
                      <SelectItem value="sm">Pequeno</SelectItem>
                      <SelectItem value="base">Normal</SelectItem>
                      <SelectItem value="lg">Grande</SelectItem>
                      <SelectItem value="xl">Extra Grande</SelectItem>
                      <SelectItem value="2xl">2x Grande</SelectItem>
                      <SelectItem value="3xl">3x Grande</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Fonte</Label>
                  <Select 
                    value={estiloAtual?.fonte || 'default'} 
                    onValueChange={(v) => handleConfigChange(estiloKey, { ...estiloAtual, fonte: v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Padrão (Sans)</SelectItem>
                      <SelectItem value="serif">Serif</SelectItem>
                      <SelectItem value="mono">Monospace</SelectItem>
                      <SelectItem value="display">Display</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`${estiloKey}-negrito`}
                      checked={estiloAtual?.negrito || false}
                      onCheckedChange={(v) => handleConfigChange(estiloKey, { ...estiloAtual, negrito: v })}
                    />
                    <Label htmlFor={`${estiloKey}-negrito`} className="text-xs font-bold">B</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`${estiloKey}-italico`}
                      checked={estiloAtual?.italico || false}
                      onCheckedChange={(v) => handleConfigChange(estiloKey, { ...estiloAtual, italico: v })}
                    />
                    <Label htmlFor={`${estiloKey}-italico`} className="text-xs italic">I</Label>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
        
        return (
          <div className="space-y-4">
            {/* Título */}
            <div className="space-y-2">
              <Label>Título</Label>
              <Input 
                value={cardConfig.titulo || ''} 
                onChange={(e) => handleConfigChange('titulo', e.target.value)}
              />
              {renderEstiloTextoEditor('Título', 'estiloTitulo', cardConfig.estiloTitulo)}
            </div>
            
            {/* Descrição */}
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea 
                value={cardConfig.descricao || ''} 
                onChange={(e) => handleConfigChange('descricao', e.target.value)}
              />
              {cardConfig.descricao && renderEstiloTextoEditor('Descrição', 'estiloDescricao', cardConfig.estiloDescricao)}
            </div>
            
            {/* Imagem */}
            <div>
              <Label>Imagem (opcional)</Label>
              <div className="flex gap-2 mt-1">
                <Input 
                  value={cardConfig.imagem_url || ''} 
                  onChange={(e) => handleConfigChange('imagem_url', e.target.value)}
                  placeholder="URL da imagem"
                />
                <Button variant="outline" size="icon" asChild disabled={uploading}>
                  <label className="cursor-pointer">
                    <Upload className="h-4 w-4" />
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, 'imagem_url')}
                    />
                  </label>
                </Button>
              </div>
            </div>
            
            {/* Link */}
            <div>
              <Label>Link (opcional)</Label>
              <Input 
                value={cardConfig.link_url || ''} 
                onChange={(e) => handleConfigChange('link_url', e.target.value)}
                placeholder="https://..."
              />
            </div>
            
            {/* Botão */}
            <div className="space-y-2">
              <Label>Texto do Botão (opcional)</Label>
              <Input 
                value={cardConfig.botao_texto || ''} 
                onChange={(e) => handleConfigChange('botao_texto', e.target.value)}
                placeholder="Saiba mais"
              />
              {cardConfig.botao_texto && renderEstiloTextoEditor('Botão', 'estiloBotao', cardConfig.estiloBotao)}
            </div>
          </div>
        );

      case 'texto':
        const textoConfig = secao.config as SecaoTextoConfig;
        return (
          <div className="space-y-4">
            <div>
              <Label>Conteúdo</Label>
              <Textarea 
                value={textoConfig.conteudo || ''} 
                onChange={(e) => handleConfigChange('conteudo', e.target.value)}
                rows={4}
              />
            </div>
            <div>
              <Label>Estilo</Label>
              <Select 
                value={textoConfig.estilo || 'normal'} 
                onValueChange={(v) => handleConfigChange('estilo', v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="destaque">Destaque</SelectItem>
                  <SelectItem value="titulo">Título</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'grid':
        const gridConfig = secao.config as SecaoGridConfig;
        const itens = gridConfig.itens || [];
        return (
          <div className="space-y-4">
            <div>
              <Label>Colunas</Label>
              <Select 
                value={String(gridConfig.colunas || 3)} 
                onValueChange={(v) => handleConfigChange('colunas', Number(v))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 Colunas</SelectItem>
                  <SelectItem value="3">3 Colunas</SelectItem>
                  <SelectItem value="4">4 Colunas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Itens do Grid</Label>
              <div className="space-y-2 mt-2">
                {itens.map((item, index) => (
                  <div key={index} className="flex gap-2 items-start p-2 border rounded">
                    <div className="flex-1 space-y-2">
                      <div className="flex gap-2">
                        <Input 
                          value={item.imagem_url || ''} 
                          onChange={(e) => {
                            const newItens = [...itens];
                            newItens[index] = { ...item, imagem_url: e.target.value };
                            handleConfigChange('itens', newItens);
                          }}
                          placeholder="URL da imagem"
                          className="flex-1"
                        />
                        <Button variant="outline" size="icon" asChild disabled={uploading}>
                          <label className="cursor-pointer">
                            <Upload className="h-4 w-4" />
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="image/*"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setUploading(true);
                                try {
                                  const url = await onUploadImage(file);
                                  const newItens = [...itens];
                                  newItens[index] = { ...item, imagem_url: url };
                                  handleConfigChange('itens', newItens);
                                } finally {
                                  setUploading(false);
                                }
                              }}
                            />
                          </label>
                        </Button>
                      </div>
                      <Input 
                        value={item.titulo || ''} 
                        onChange={(e) => {
                          const newItens = [...itens];
                          newItens[index] = { ...item, titulo: e.target.value };
                          handleConfigChange('itens', newItens);
                        }}
                        placeholder="Título (opcional)"
                      />
                      <Input 
                        value={item.link_url || ''} 
                        onChange={(e) => {
                          const newItens = [...itens];
                          newItens[index] = { ...item, link_url: e.target.value };
                          handleConfigChange('itens', newItens);
                        }}
                        placeholder="Link (opcional)"
                      />
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => {
                        const newItens = itens.filter((_, i) => i !== index);
                        handleConfigChange('itens', newItens);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    handleConfigChange('itens', [...itens, { imagem_url: '', titulo: '', link_url: '' }]);
                  }}
                >
                  Adicionar Item
                </Button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
            {tipoIcons[secao.tipo]}
            <CardTitle className="text-sm font-medium">
              {tipoLabels[secao.tipo]}
            </CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={onRemove}>
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="py-3 px-4 pt-0 space-y-3">
        <Tabs defaultValue="conteudo" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="conteudo" className="text-xs">Conteúdo</TabsTrigger>
            <TabsTrigger value="estilo" className="text-xs">
              <Palette className="h-3 w-3 mr-1" />
              Estilo
            </TabsTrigger>
          </TabsList>
          <TabsContent value="conteudo" className="mt-3">
            {renderConfigFields()}
          </TabsContent>
          <TabsContent value="estilo" className="mt-3">
            {renderEstiloFields()}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
