import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, X, Upload, Loader2, ImagePlus } from "lucide-react";
import { Input } from "@/components/ui/input";

interface UploadFotosCompraProps {
  fotos: string[];
  onFotosChange: (fotos: string[]) => void;
  maxFotos?: number;
  disabled?: boolean;
}

export function UploadFotosCompra({
  fotos,
  onFotosChange,
  maxFotos = 5,
  disabled = false,
}: UploadFotosCompraProps) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (fotos.length + files.length > maxFotos) {
      toast.error(`Máximo de ${maxFotos} fotos permitidas`);
      return;
    }

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const novasUrls: string[] = [];

      for (const file of Array.from(files)) {
        // Validar tipo de arquivo
        if (!file.type.startsWith('image/')) {
          toast.error(`Arquivo ${file.name} não é uma imagem`);
          continue;
        }

        // Validar tamanho (máx 5MB)
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`Arquivo ${file.name} muito grande (máx 5MB)`);
          continue;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('compras-fotos')
          .upload(fileName, file, {
            contentType: file.type,
            cacheControl: '3600',
          });

        if (uploadError) {
          console.error('Erro no upload:', uploadError);
          toast.error(`Erro ao enviar ${file.name}`);
          continue;
        }

        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('compras-fotos')
          .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year

        if (signedUrlError || !signedUrlData?.signedUrl) {
          toast.error(`Erro ao gerar URL para ${file.name}`);
          continue;
        }

        novasUrls.push(signedUrlData.signedUrl);
      }

      if (novasUrls.length > 0) {
        onFotosChange([...fotos, ...novasUrls]);
        toast.success(`${novasUrls.length} foto(s) enviada(s) com sucesso`);
      }
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toast.error('Erro ao enviar fotos');
    } finally {
      setUploading(false);
      // Limpa o input para permitir selecionar o mesmo arquivo novamente
      event.target.value = '';
    }
  }, [fotos, onFotosChange, maxFotos]);

  const removerFoto = useCallback(async (urlParaRemover: string) => {
    try {
      // Extrai o path do arquivo da URL
      const urlObj = new URL(urlParaRemover);
      const pathMatch = urlObj.pathname.match(/\/compras-fotos\/(.+)$/);
      
      if (pathMatch) {
        await supabase.storage
          .from('compras-fotos')
          .remove([pathMatch[1]]);
      }

      onFotosChange(fotos.filter(url => url !== urlParaRemover));
      toast.success('Foto removida');
    } catch (error) {
      console.error('Erro ao remover foto:', error);
      // Mesmo com erro no storage, remove da lista local
      onFotosChange(fotos.filter(url => url !== urlParaRemover));
    }
  }, [fotos, onFotosChange]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Camera className="h-4 w-4" />
          Fotos do Dispositivo
          <span className="text-xs font-normal text-muted-foreground ml-auto">
            {fotos.length}/{maxFotos}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Grid de fotos */}
        {fotos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {fotos.map((url, index) => (
              <div key={index} className="relative group aspect-square">
                <img
                  src={url}
                  alt={`Foto ${index + 1}`}
                  className="w-full h-full object-cover rounded-lg border"
                />
                {!disabled && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removerFoto(url)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Área de upload */}
        {!disabled && fotos.length < maxFotos && (
          <div className="relative">
            <Input
              type="file"
              accept="image/*"
              multiple
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
              id="upload-fotos-compra"
            />
            <label
              htmlFor="upload-fotos-compra"
              className={`
                flex flex-col items-center justify-center gap-2 p-6
                border-2 border-dashed rounded-lg cursor-pointer
                transition-colors hover:border-primary/50 hover:bg-muted/30
                ${uploading ? 'opacity-50 pointer-events-none' : ''}
              `}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Enviando...</span>
                </>
              ) : (
                <>
                  <ImagePlus className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground text-center">
                    Clique para adicionar fotos
                    <br />
                    <span className="text-xs">(máx. 5MB por foto)</span>
                  </span>
                </>
              )}
            </label>
          </div>
        )}

        {fotos.length === 0 && disabled && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma foto adicionada
          </p>
        )}
      </CardContent>
    </Card>
  );
}
