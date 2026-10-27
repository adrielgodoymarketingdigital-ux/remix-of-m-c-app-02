import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  // Textos: namespace "configuracoes" (logo.*).
  const { t } = useTranslation("configuracoes");
  const { uploadLogo, atualizarConfiguracao, removerLogo } = useConfiguracaoLoja();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo
    const tiposPermitidos = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"];
    if (!tiposPermitidos.includes(file.type)) {
      toast({
        title: t("logo.formatoInvalido"),
        description: t("logo.formatoInvalidoDescricao"),
        variant: "destructive",
      });
      return;
    }

    // Validar tamanho (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: t("logo.muitoGrande"),
        description: t("logo.muitoGrandeDescricao"),
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
        title: t("logo.nenhumaImagem"),
        description: t("logo.nenhumaImagemDescricao"),
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
            title: t("logo.salva"),
            description: t("logo.salvaDescricao"),
          });
        } else {
          toast({
            title: t("logo.erroSalvar"),
            description: t("logo.erroSalvarDescricao"),
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: t("logo.erroUpload"),
          description: t("logo.erroUploadDescricao"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Erro ao salvar logo:", error);
      toast({
        title: t("logo.erro"),
        description: t("logo.erroDescricao"),
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemover = async () => {
    if (logoAtual) {
      await removerLogo(logoAtual);
      const sucesso = await atualizarConfiguracao({ logo_url: null });
      if (!sucesso) {
        toast({
          title: t("logo.erroRemover"),
          description: t("logo.erroRemoverDescricao"),
          variant: "destructive",
        });
        return;
      }
    }
    setPreview(null);
    setArquivo(null);
  };

  const temAlteracoes = arquivo !== null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("logo.titulo")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preview */}
        <div className="flex items-center justify-center border-2 border-dashed rounded-lg p-8 bg-muted/10">
          {preview ? (
            <div className="relative">
              <img
                src={preview}
                alt={t("logo.previewAlt")}
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
                {t("logo.nenhuma")}
              </p>
            </div>
          )}
        </div>

        {/* Upload */}
        <div className="space-y-2">
          <Label htmlFor="logo-upload">{t("logo.selecionar")}</Label>
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
            {t("logo.formatos")}
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
              {t("logo.salvando")}
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {t("logo.salvar")}
            </>
          )}
        </Button>

        {temAlteracoes && (
          <p className="text-sm text-amber-600 text-center">
            {t("logo.naoSalvas")}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
