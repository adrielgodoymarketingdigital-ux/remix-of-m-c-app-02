import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UploadFotosProdutoProps {
  fotos?: string[];
  onFotosChange: (urls: string[]) => void;
  maxFotos?: number;
}

export function UploadFotosProduto({ 
  fotos = [], 
  onFotosChange,
  maxFotos = 5 
}: UploadFotosProdutoProps) {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        return;
      }

      const files = Array.from(event.target.files);
      
      // Validar limite de fotos
      if (fotos.length + files.length > maxFotos) {
        toast({
          title: "Limite excedido",
          description: `Você pode adicionar no máximo ${maxFotos} fotos.`,
          variant: "destructive",
        });
        return;
      }

      const novasUrls: string[] = [];

      // Upload de múltiplos arquivos
      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('produtos-fotos')
          .upload(filePath, file);

        if (uploadError) {
          throw uploadError;
        }

        const { data } = supabase.storage
          .from('produtos-fotos')
          .getPublicUrl(filePath);

        novasUrls.push(data.publicUrl);
      }

      onFotosChange([...fotos, ...novasUrls]);

      toast({
        title: "Fotos enviadas",
        description: `${files.length} foto(s) enviada(s) com sucesso.`,
      });
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toast({
        title: "Erro ao enviar fotos",
        description: "Ocorreu um erro ao enviar as fotos.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      // Resetar input para permitir re-upload do mesmo arquivo
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleRemove = async (urlParaRemover: string, index: number) => {
    try {
      const fileName = urlParaRemover.split('/').pop();
      if (fileName) {
        await supabase.storage
          .from('produtos-fotos')
          .remove([fileName]);
      }

      const novasFotos = fotos.filter((_, i) => i !== index);
      onFotosChange(novasFotos);

      toast({
        title: "Foto removida",
        description: "A foto foi removida com sucesso.",
      });
    } catch (error) {
      console.error('Erro ao remover foto:', error);
      toast({
        title: "Erro ao remover foto",
        description: "Ocorreu um erro ao remover a foto.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Fotos do Item</Label>
        <span className="text-xs text-muted-foreground">
          {fotos.length}/{maxFotos} fotos
        </span>
      </div>
      
      {/* Grid de fotos existentes */}
      {fotos.length > 0 && (
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
          {fotos.map((url, index) => (
            <div key={index} className="relative group aspect-square">
              <img 
                src={url} 
                alt={`Foto ${index + 1}`} 
                className="w-full h-full object-cover rounded-lg border"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleRemove(url, index)}
              >
                <X className="h-3 w-3" />
              </Button>
              {/* Badge indicando foto principal */}
              {index === 0 && (
                <div className="absolute bottom-1 left-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded">
                  Principal
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Área de upload */}
      {fotos.length < maxFotos && (
        <div className="border-2 border-dashed rounded-lg p-4 text-center">
          <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground" />
          <div className="mt-2">
            <Label htmlFor="fotos-produto-upload" className="cursor-pointer">
              <div className="flex items-center justify-center gap-2 text-sm">
                <Upload className="h-4 w-4" />
                <span>{uploading ? 'Enviando...' : 'Adicionar fotos'}</span>
              </div>
            </Label>
            <Input
              id="fotos-produto-upload"
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            PNG, JPG, WEBP até 5MB
          </p>
        </div>
      )}
    </div>
  );
}
