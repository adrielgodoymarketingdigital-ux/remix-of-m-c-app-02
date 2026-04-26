import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Palette, 
  Type, 
  Settings2, 
  Check, 
  RefreshCw,
  Smartphone,
  Image,
  Upload,
  X,
  Paintbrush
} from "lucide-react";
import { 
  ConfiguracaoCatalogo, 
  TEMPLATES_PADRAO, 
  TEXTOS_PADRAO,
  TemplatesCatalogo 
} from "@/types/catalogo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ConfiguracaoTemplatesProps {
  config: ConfiguracaoCatalogo;
  onConfigChange: (config: ConfiguracaoCatalogo) => void;
}

export function ConfiguracaoTemplates({ config, onConfigChange }: ConfiguracaoTemplatesProps) {
  const [templatePersonalizado, setTemplatePersonalizado] = useState<TemplatesCatalogo | null>(null);
  const [uploadingFundo, setUploadingFundo] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fundoInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const templateAtual = TEMPLATES_PADRAO.find(t => t.id === config.templateId) || TEMPLATES_PADRAO[0];

  const handleTemplateSelect = (templateId: string) => {
    onConfigChange({
      ...config,
      templateId,
    });
    setTemplatePersonalizado(null);
  };

  const handleTextosChange = (campo: keyof typeof config.textos, valor: string) => {
    onConfigChange({
      ...config,
      textos: {
        ...config.textos,
        [campo]: valor,
      },
    });
  };

  const handleOpcoesChange = (campo: keyof ConfiguracaoCatalogo, valor: boolean | number | string) => {
    onConfigChange({
      ...config,
      [campo]: valor,
    });
  };

  const resetTextos = () => {
    onConfigChange({
      ...config,
      textos: TEXTOS_PADRAO,
    });
  };

  const uploadImagem = async (file: File, tipo: 'fundo' | 'logo') => {
    const setUploading = tipo === 'fundo' ? setUploadingFundo : setUploadingLogo;
    setUploading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error("Usuário não autenticado");
        return;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${userData.user.id}/${tipo}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('catalogo-assets')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        // Se o bucket não existir, tentar criar
        if (uploadError.message.includes('not found')) {
          toast.error("Configure o bucket 'catalogo-assets' no storage");
          return;
        }
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from('catalogo-assets')
        .getPublicUrl(fileName);

      if (tipo === 'fundo') {
        onConfigChange({ ...config, imagemFundoUrl: urlData.publicUrl });
      } else {
        onConfigChange({ ...config, logoPersonalizadoUrl: urlData.publicUrl });
      }

      toast.success(`${tipo === 'fundo' ? 'Imagem de fundo' : 'Logo'} atualizado!`);
    } catch (err) {
      console.error("Erro ao fazer upload:", err);
      toast.error("Erro ao fazer upload da imagem");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, tipo: 'fundo' | 'logo') => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error("Selecione uma imagem válida");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Imagem muito grande (máx. 5MB)");
        return;
      }
      uploadImagem(file, tipo);
    }
  };

  const removerImagem = (tipo: 'fundo' | 'logo') => {
    if (tipo === 'fundo') {
      onConfigChange({ ...config, imagemFundoUrl: undefined });
    } else {
      onConfigChange({ ...config, logoPersonalizadoUrl: undefined });
    }
    toast.success(`${tipo === 'fundo' ? 'Imagem de fundo' : 'Logo'} removido`);
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="templates" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="templates" className="flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="visual" className="flex items-center gap-1.5">
            <Paintbrush className="w-3.5 h-3.5" />
            Visual
          </TabsTrigger>
          <TabsTrigger value="textos" className="flex items-center gap-1.5">
            <Type className="w-3.5 h-3.5" />
            Textos
          </TabsTrigger>
          <TabsTrigger value="opcoes" className="flex items-center gap-1.5">
            <Settings2 className="w-3.5 h-3.5" />
            Opções
          </TabsTrigger>
        </TabsList>

        {/* Templates */}
        <TabsContent value="templates" className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Escolha um estilo visual para seu catálogo
          </p>
          
          <div className="grid grid-cols-2 gap-3">
            {TEMPLATES_PADRAO.map((template) => (
              <Card
                key={template.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  config.templateId === template.id
                    ? "ring-2 ring-primary border-primary"
                    : "hover:border-primary/50"
                }`}
                onClick={() => handleTemplateSelect(template.id)}
              >
                <CardContent className="p-3">
                  {/* Preview de cores */}
                  <div className="flex gap-1 mb-2">
                    <div
                      className="w-6 h-6 rounded-full border"
                      style={{ backgroundColor: template.cores.primaria }}
                    />
                    <div
                      className="w-6 h-6 rounded-full border"
                      style={{ backgroundColor: template.cores.secundaria }}
                    />
                    <div
                      className="w-6 h-6 rounded-full border"
                      style={{ backgroundColor: template.cores.destaque }}
                    />
                  </div>

                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-sm">{template.nome}</h4>
                      <p className="text-xs text-muted-foreground">
                        {template.descricao}
                      </p>
                    </div>
                    {config.templateId === template.id && (
                      <Check className="w-4 h-4 text-primary shrink-0" />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Preview do template selecionado */}
          <Card className="overflow-hidden">
            <div 
              className="h-24 flex items-center justify-center"
              style={{ backgroundColor: templateAtual.cores.primaria }}
            >
              <div 
                className="text-center"
                style={{ color: templateAtual.cores.fundo }}
              >
                <Smartphone className="w-8 h-8 mx-auto mb-1" />
                <span className="text-xs font-medium">Preview</span>
              </div>
            </div>
            <CardContent className="p-3" style={{ backgroundColor: templateAtual.cores.fundo }}>
              <p 
                className="text-sm font-semibold"
                style={{ color: templateAtual.cores.texto }}
              >
                {templateAtual.nome}
              </p>
              <p 
                className="text-xs"
                style={{ color: templateAtual.cores.secundaria }}
              >
                {templateAtual.descricao}
              </p>
              <Badge
                className="mt-2"
                style={{ 
                  backgroundColor: templateAtual.cores.destaque,
                  color: templateAtual.cores.fundo,
                }}
              >
                R$ 1.999,00
              </Badge>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Visual - Nova aba */}
        <TabsContent value="visual" className="mt-4 space-y-6">
          <p className="text-sm text-muted-foreground">
            Personalize a aparência do catálogo
          </p>

          {/* Imagem de fundo */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Image className="w-4 h-4" />
              Imagem de Fundo do Header
            </Label>
            <p className="text-xs text-muted-foreground">
              A imagem aparecerá como fundo do cabeçalho do catálogo
            </p>
            
            <input
              ref={fundoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileChange(e, 'fundo')}
            />

            {config.imagemFundoUrl ? (
              <div className="space-y-2">
                {/* Preview da imagem de fundo */}
                <div className="relative rounded-lg overflow-hidden border">
                  <div 
                    className="w-full h-40 bg-cover bg-center flex items-center justify-center"
                    style={{ 
                      backgroundImage: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.5)), url(${config.imagemFundoUrl})`,
                    }}
                  >
                    <div className="text-center text-white">
                      <p className="font-bold text-lg">Preview do Header</p>
                      <p className="text-sm opacity-80">Como ficará no catálogo</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => fundoInputRef.current?.click()}
                    disabled={uploadingFundo}
                    className="flex-1"
                  >
                    <Upload className="w-4 h-4 mr-1" />
                    {uploadingFundo ? "Enviando..." : "Trocar imagem"}
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => removerImagem('fundo')}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Remover
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full h-24 border-dashed"
                onClick={() => fundoInputRef.current?.click()}
                disabled={uploadingFundo}
              >
                <div className="text-center">
                  <Upload className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {uploadingFundo ? "Enviando..." : "Clique para adicionar imagem de fundo"}
                  </span>
                </div>
              </Button>
            )}
          </div>

          {/* Logo personalizado */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Image className="w-4 h-4" />
              Logo Personalizado do Catálogo
            </Label>
            <p className="text-xs text-muted-foreground">
              Use um logo diferente do cadastrado na loja
            </p>
            
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileChange(e, 'logo')}
            />

            {config.logoPersonalizadoUrl ? (
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <img 
                  src={config.logoPersonalizadoUrl} 
                  alt="Logo personalizado"
                  className="h-12 w-auto object-contain"
                />
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => removerImagem('logo')}
                >
                  <X className="w-4 h-4 mr-1" />
                  Remover
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo}
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploadingLogo ? "Enviando..." : "Adicionar logo personalizado"}
              </Button>
            )}
          </div>

          {/* Cores personalizadas */}
          <div className="space-y-4 pt-4 border-t">
            <Label>Cores Personalizadas (opcional)</Label>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Cor do Header</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={config.corHeaderPersonalizada || templateAtual.cores.primaria}
                    onChange={(e) => handleOpcoesChange('corHeaderPersonalizada', e.target.value)}
                    className="w-10 h-10 rounded border cursor-pointer"
                  />
                  {config.corHeaderPersonalizada && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleOpcoesChange('corHeaderPersonalizada', '')}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs">Cor de Fundo</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={config.corFundoPersonalizada || templateAtual.cores.fundo}
                    onChange={(e) => handleOpcoesChange('corFundoPersonalizada', e.target.value)}
                    className="w-10 h-10 rounded border cursor-pointer"
                  />
                  {config.corFundoPersonalizada && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleOpcoesChange('corFundoPersonalizada', '')}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs">Cor Primária</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={config.corPrimariaPersonalizada || templateAtual.cores.primaria}
                    onChange={(e) => handleOpcoesChange('corPrimariaPersonalizada', e.target.value)}
                    className="w-10 h-10 rounded border cursor-pointer"
                  />
                  {config.corPrimariaPersonalizada && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleOpcoesChange('corPrimariaPersonalizada', '')}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs">Cor do Texto</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={config.corTextoPersonalizada || templateAtual.cores.texto}
                    onChange={(e) => handleOpcoesChange('corTextoPersonalizada', e.target.value)}
                    className="w-10 h-10 rounded border cursor-pointer"
                  />
                  {config.corTextoPersonalizada && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleOpcoesChange('corTextoPersonalizada', '')}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Estilo do Header */}
          <div className="space-y-3 pt-4 border-t">
            <Label>Estilo do Header</Label>
            <Select 
              value={config.estiloHeader || 'gradiente'} 
              onValueChange={(v) => handleOpcoesChange('estiloHeader', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simples">Simples (cor sólida)</SelectItem>
                <SelectItem value="gradiente">Gradiente suave</SelectItem>
                <SelectItem value="imagem">Com imagem de fundo</SelectItem>
                <SelectItem value="minimalista">Minimalista (sem fundo)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Estilo dos Cards */}
          <div className="grid grid-cols-3 gap-3 pt-4 border-t">
            <div className="space-y-2">
              <Label className="text-xs">Borda dos Cards</Label>
              <Select 
                value={config.bordaCards || 'arredondada'} 
                onValueChange={(v) => handleOpcoesChange('bordaCards', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="arredondada">Arredondada</SelectItem>
                  <SelectItem value="quadrada">Quadrada</SelectItem>
                  <SelectItem value="sutil">Sutil</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Sombra dos Cards</Label>
              <Select 
                value={config.sombraCards || 'media'} 
                onValueChange={(v) => handleOpcoesChange('sombraCards', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhuma">Nenhuma</SelectItem>
                  <SelectItem value="leve">Leve</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="forte">Forte</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Espaçamento</Label>
              <Select 
                value={config.espacamentoCards || 'normal'} 
                onValueChange={(v) => handleOpcoesChange('espacamentoCards', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="compacto">Compacto</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="amplo">Amplo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </TabsContent>

        {/* Textos */}
        <TabsContent value="textos" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Personalize os textos do catálogo
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetTextos}
              className="text-xs"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Restaurar
            </Button>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tituloCapa">Título da Capa</Label>
              <Input
                id="tituloCapa"
                value={config.textos.tituloCapa}
                onChange={(e) => handleTextosChange("tituloCapa", e.target.value)}
                placeholder="Catálogo de Dispositivos"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subtituloCapa">Subtítulo da Capa</Label>
              <Input
                id="subtituloCapa"
                value={config.textos.subtituloCapa}
                onChange={(e) => handleTextosChange("subtituloCapa", e.target.value)}
                placeholder="Celulares, Tablets e Eletrônicos"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="textoGarantia">
                Texto de Garantia
                <span className="text-xs text-muted-foreground ml-2">
                  Use {"{tempo}"} para o período
                </span>
              </Label>
              <Input
                id="textoGarantia"
                value={config.textos.textoGarantia}
                onChange={(e) => handleTextosChange("textoGarantia", e.target.value)}
                placeholder="Garantia de {tempo}"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="textoPreco">Texto Antes do Preço</Label>
              <Input
                id="textoPreco"
                value={config.textos.textoPreco}
                onChange={(e) => handleTextosChange("textoPreco", e.target.value)}
                placeholder="A partir de"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="textoContato">Texto de Contato</Label>
              <Textarea
                id="textoContato"
                value={config.textos.textoContato}
                onChange={(e) => handleTextosChange("textoContato", e.target.value)}
                placeholder="Entre em contato para mais informações"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rodape">
                Texto do Rodapé
                <span className="text-xs text-muted-foreground ml-2">
                  Use {"{data}"} para a data atual
                </span>
              </Label>
              <Input
                id="rodape"
                value={config.textos.rodape}
                onChange={(e) => handleTextosChange("rodape", e.target.value)}
                placeholder="Atualizado em {data}"
              />
            </div>
          </div>
        </TabsContent>

        {/* Opções */}
        <TabsContent value="opcoes" className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Configure quais informações exibir
          </p>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <Label htmlFor="mostrarPrecos" className="cursor-pointer">Mostrar preços</Label>
                <p className="text-xs text-muted-foreground">Exibir valores dos dispositivos</p>
              </div>
              <Switch id="mostrarPrecos" checked={config.mostrarPrecos} onCheckedChange={(v) => handleOpcoesChange("mostrarPrecos", v)} />
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <Label htmlFor="mostrarGarantia" className="cursor-pointer">Mostrar garantia</Label>
                <p className="text-xs text-muted-foreground">Exibir informações de garantia</p>
              </div>
              <Switch id="mostrarGarantia" checked={config.mostrarGarantia} onCheckedChange={(v) => handleOpcoesChange("mostrarGarantia", v)} />
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <Label htmlFor="mostrarBateria" className="cursor-pointer">Mostrar saúde da bateria</Label>
                <p className="text-xs text-muted-foreground">Exibir porcentagem de bateria</p>
              </div>
              <Switch id="mostrarBateria" checked={config.mostrarBateria} onCheckedChange={(v) => handleOpcoesChange("mostrarBateria", v)} />
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <Label htmlFor="mostrarQuantidade" className="cursor-pointer">Mostrar quantidade disponível</Label>
                <p className="text-xs text-muted-foreground">Exibir número de unidades</p>
              </div>
              <Switch id="mostrarQuantidade" checked={config.mostrarQuantidade} onCheckedChange={(v) => handleOpcoesChange("mostrarQuantidade", v)} />
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <Label htmlFor="mostrarCondicao" className="cursor-pointer">Mostrar condição</Label>
                <p className="text-xs text-muted-foreground">Novo, semi-novo ou usado</p>
              </div>
              <Switch id="mostrarCondicao" checked={config.mostrarCondicao ?? true} onCheckedChange={(v) => handleOpcoesChange("mostrarCondicao", v)} />
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <Label htmlFor="mostrarCapacidade" className="cursor-pointer">Mostrar capacidade</Label>
                <p className="text-xs text-muted-foreground">Armazenamento em GB</p>
              </div>
              <Switch id="mostrarCapacidade" checked={config.mostrarCapacidade ?? true} onCheckedChange={(v) => handleOpcoesChange("mostrarCapacidade", v)} />
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <Label htmlFor="mostrarCor" className="cursor-pointer">Mostrar cor</Label>
                <p className="text-xs text-muted-foreground">Cor do dispositivo</p>
              </div>
              <Switch id="mostrarCor" checked={config.mostrarCor ?? true} onCheckedChange={(v) => handleOpcoesChange("mostrarCor", v)} />
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <Label htmlFor="mostrarLogo" className="cursor-pointer">Mostrar logo da loja</Label>
                <p className="text-xs text-muted-foreground">Exibir logotipo no catálogo</p>
              </div>
              <Switch id="mostrarLogo" checked={config.mostrarLogo ?? true} onCheckedChange={(v) => handleOpcoesChange("mostrarLogo", v)} />
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <Label htmlFor="mostrarContato" className="cursor-pointer">Mostrar informações de contato</Label>
                <p className="text-xs text-muted-foreground">Telefone, WhatsApp e email</p>
              </div>
              <Switch id="mostrarContato" checked={config.mostrarContato ?? true} onCheckedChange={(v) => handleOpcoesChange("mostrarContato", v)} />
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <Label htmlFor="mostrarSubtitulo" className="cursor-pointer">Mostrar subtítulo</Label>
                <p className="text-xs text-muted-foreground">Subtítulo abaixo do título</p>
              </div>
              <Switch id="mostrarSubtitulo" checked={config.mostrarSubtitulo ?? true} onCheckedChange={(v) => handleOpcoesChange("mostrarSubtitulo", v)} />
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <Label htmlFor="mostrarBotaoWhatsApp" className="cursor-pointer">Botão WhatsApp flutuante</Label>
                <p className="text-xs text-muted-foreground">Exibir botão de contato rápido</p>
              </div>
              <Switch id="mostrarBotaoWhatsApp" checked={config.mostrarBotaoWhatsApp ?? true} onCheckedChange={(v) => handleOpcoesChange("mostrarBotaoWhatsApp", v)} />
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <Label htmlFor="mostrarMarca" className="cursor-pointer">Mostrar marca separada</Label>
                <p className="text-xs text-muted-foreground">Exibir marca acima do modelo</p>
              </div>
              <Switch id="mostrarMarca" checked={config.mostrarMarca ?? true} onCheckedChange={(v) => handleOpcoesChange("mostrarMarca", v)} />
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <Label htmlFor="mostrarDesconto" className="cursor-pointer">Mostrar badge de desconto</Label>
                <p className="text-xs text-muted-foreground">Exibir percentual de desconto</p>
              </div>
              <Switch id="mostrarDesconto" checked={config.mostrarDesconto ?? true} onCheckedChange={(v) => handleOpcoesChange("mostrarDesconto", v)} />
            </div>

            <div className="space-y-3 pt-4 border-t">
              <Label>Tamanho da fonte</Label>
              <Select 
                value={config.tamanhoFonte || 'medio'} 
                onValueChange={(v) => handleOpcoesChange('tamanhoFonte', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pequeno">Pequeno</SelectItem>
                  <SelectItem value="medio">Médio</SelectItem>
                  <SelectItem value="grande">Grande</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 pt-4 border-t">
              <Label>Texto do botão WhatsApp</Label>
              <Input
                value={config.textoBotaoWhatsApp || 'WhatsApp'}
                onChange={(e) => handleOpcoesChange('textoBotaoWhatsApp', e.target.value)}
                placeholder="WhatsApp"
              />
            </div>

            <div className="space-y-3 pt-4 border-t">
              <Label>Cor do botão WhatsApp</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={config.corBotaoWhatsApp || '#22c55e'}
                  onChange={(e) => handleOpcoesChange('corBotaoWhatsApp', e.target.value)}
                  className="w-10 h-10 rounded border cursor-pointer"
                />
                {config.corBotaoWhatsApp && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleOpcoesChange('corBotaoWhatsApp', '')}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center justify-between">
                <Label>Itens por página no PDF</Label>
                <span className="text-sm font-medium">{config.itensPerPage}</span>
              </div>
              <Slider
                value={[config.itensPerPage]}
                onValueChange={([v]) => handleOpcoesChange("itensPerPage", v)}
                min={4}
                max={8}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                {config.itensPerPage <= 4 ? "Cartões maiores" : config.itensPerPage >= 8 ? "Cartões menores" : "Tamanho médio"}
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
