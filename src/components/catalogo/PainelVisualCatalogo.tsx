// Painel "Visual" do Catálogo: imagem de fundo e logo (vão ao storage na hora; a URL só é gravada
// quando a tela salva o catalogo_config), 4 cores, estilo do cabeçalho e dos cartões.
// Extraído de ConfiguracaoTemplates.tsx SEM mudar o JSX: o celular renderiza o mesmo HTML.
import { useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Image, Upload, X } from "lucide-react";
import { ConfiguracaoCatalogo, TEMPLATES_PADRAO } from "@/types/catalogo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PainelCatalogoProps {
  config: ConfiguracaoCatalogo;
  onConfigChange: (config: ConfiguracaoCatalogo) => void;
}

export function PainelVisualCatalogo({ config, onConfigChange }: PainelCatalogoProps) {
  const [uploadingFundo, setUploadingFundo] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fundoInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const templateAtual = TEMPLATES_PADRAO.find(t => t.id === config.templateId) || TEMPLATES_PADRAO[0];

  const handleOpcoesChange = (campo: keyof ConfiguracaoCatalogo, valor: boolean | number | string) => {
    onConfigChange({
      ...config,
      [campo]: valor,
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
    <>
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
    </>
  );
}
