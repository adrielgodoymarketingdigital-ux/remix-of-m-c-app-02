import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, Image as ImageIcon, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";

interface UploadLogoLojaProps {
  logoAtual?: string | null;
  onUploadSuccess: (url: string) => void;
}

export const UploadLogoLoja = ({
  logoAtual,
  onUploadSuccess,
}: UploadLogoLojaProps) => {
  const [preview, setPreview] = useState<string | null>(logoAtual || null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const { uploadLogo, atualizarConfiguracao, removerLogo } = useConfiguracaoLoja();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo
    const tiposPermitidos = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"];
    if (!tiposPermitidos.includes(file.type)) {
      toast({
        title: "Formato inválido",
        description: "Use apenas PNG, JPG ou SVG",
        variant: "destructive",
      });
      return;
    }

    // Validar tamanho (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo é 2MB",
        variant: "destructive",
      });
      return;
    }

    // Salvar arquivo para upload posterior
    setArquivo(file);

    // Preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSalvar = async () => {
    if (!arquivo) {
      toast({
        title: "Nenhuma imagem selecionada",
        description: "Selecione uma imagem para fazer upload",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Fazer upload do arquivo
      const url = await uploadLogo(arquivo);
      
      if (url) {
        // Atualizar configuração com a nova URL
        const sucesso = await atualizarConfiguracao({ logo_url: url });
        
        if (sucesso) {
          onUploadSuccess(url);
          setArquivo(null);
          toast({
            title: "Logo salva com sucesso",
            description: "A logo da loja foi atualizada.",
          });
        } else {
          toast({
            title: "Erro ao salvar",
            description: "Não foi possível atualizar a logo.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Erro no upload",
          description: "Não foi possível fazer upload da imagem.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Erro ao salvar logo:", error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao salvar a logo.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemover = async () => {
    if (logoAtual) {
      await removerLogo(logoAtual);
      await atualizarConfiguracao({ logo_url: null });
    }
    setPreview(null);
    setArquivo(null);
  };

  const temAlteracoes = arquivo !== null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logo da Loja</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preview */}
        <div className="flex items-center justify-center border-2 border-dashed rounded-lg p-8 bg-muted/10">
          {preview ? (
            <div className="relative">
              <img
                src={preview}
                alt="Preview Logo"
                className="max-h-40 max-w-full object-contain"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2"
                onClick={handleRemover}
                disabled={uploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="text-center space-y-2">
              <ImageIcon className="h-16 w-16 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Nenhuma logo selecionada
              </p>
            </div>
          )}
        </div>

        {/* Upload */}
        <div className="space-y-2">
          <Label htmlFor="logo-upload">Selecionar Imagem</Label>
          <div className="flex gap-2">
            <Input
              id="logo-upload"
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/svg+xml"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Formatos aceitos: PNG, JPG, SVG. Tamanho máximo: 2MB
          </p>
        </div>

        {/* Botão Salvar */}
        <Button 
          onClick={handleSalvar} 
          disabled={uploading || !temAlteracoes}
          className="w-full"
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Salvar Logo
            </>
          )}
        </Button>

        {temAlteracoes && (
          <p className="text-sm text-amber-600 text-center">
            Você tem alterações não salvas. Clique em "Salvar Logo" para aplicar.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
