import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, X, FileText, Image } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UploadDocumentosVendedorProps {
  documentoFrente: string | null;
  documentoVerso: string | null;
  onDocumentoFrenteChange: (url: string | null) => void;
  onDocumentoVersoChange: (url: string | null) => void;
}

export function UploadDocumentosVendedor({
  documentoFrente,
  documentoVerso,
  onDocumentoFrenteChange,
  onDocumentoVersoChange,
}: UploadDocumentosVendedorProps) {
  const [uploading, setUploading] = useState<'frente' | 'verso' | null>(null);
  const inputFrenteRef = useRef<HTMLInputElement>(null);
  const inputVersoRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File, tipo: 'frente' | 'verso') => {
    // Validar tipo de arquivo
    const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!tiposPermitidos.includes(file.type)) {
      toast.error("Tipo de arquivo não permitido. Use JPG, PNG, WEBP ou PDF.");
      return;
    }

    // Validar tamanho (máx 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 10MB.");
      return;
    }

    setUploading(tipo);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const extensao = file.name.split('.').pop() || 'jpg';
      const nomeArquivo = `${user.id}/${Date.now()}_${tipo}.${extensao}`;

      const { error: uploadError } = await supabase.storage
        .from("compras-documentos")
        .upload(nomeArquivo, file);

      if (uploadError) throw uploadError;

      const { data: urlData, error: urlError } = await supabase.storage
        .from("compras-documentos")
        .createSignedUrl(nomeArquivo, 60 * 60 * 24 * 365); // 1 year

      if (urlError || !urlData?.signedUrl) throw new Error("Erro ao gerar URL do documento");

      if (tipo === 'frente') {
        onDocumentoFrenteChange(urlData.signedUrl);
      } else {
        onDocumentoVersoChange(urlData.signedUrl);
      }

      toast.success(`Documento (${tipo === 'frente' ? 'frente' : 'verso'}) enviado com sucesso!`);
    } catch (error) {
      console.error("Erro no upload:", error);
      toast.error("Erro ao enviar documento");
    } finally {
      setUploading(null);
    }
  };

  const handleRemove = async (tipo: 'frente' | 'verso') => {
    const url = tipo === 'frente' ? documentoFrente : documentoVerso;
    if (!url) return;

    try {
      // Extrair o caminho do arquivo da URL
      const urlParts = url.split('/compras-documentos/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        await supabase.storage.from("compras-documentos").remove([filePath]);
      }

      if (tipo === 'frente') {
        onDocumentoFrenteChange(null);
      } else {
        onDocumentoVersoChange(null);
      }

      toast.success("Documento removido");
    } catch (error) {
      console.error("Erro ao remover:", error);
      toast.error("Erro ao remover documento");
    }
  };

  const isPDF = (url: string | null) => url?.toLowerCase().endsWith('.pdf');

  const renderPreview = (url: string | null, tipo: 'frente' | 'verso') => {
    if (!url) return null;

    return (
      <div className="relative group">
        {isPDF(url) ? (
          <div className="w-full h-32 bg-muted rounded-lg flex flex-col items-center justify-center border">
            <FileText className="h-10 w-10 text-muted-foreground mb-2" />
            <span className="text-xs text-muted-foreground">Documento PDF</span>
            <a 
              href={url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline mt-1"
            >
              Visualizar PDF
            </a>
          </div>
        ) : (
          <img 
            src={url} 
            alt={`Documento ${tipo}`}
            className="w-full h-32 object-cover rounded-lg border"
          />
        )}
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => handleRemove(tipo)}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Documento do Vendedor (RG/CNH)</Label>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        {/* Frente do documento */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Frente</Label>
          {documentoFrente ? (
            renderPreview(documentoFrente, 'frente')
          ) : (
            <div
              className="border-2 border-dashed rounded-lg p-4 h-32 flex flex-col items-center justify-center cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => inputFrenteRef.current?.click()}
            >
              {uploading === 'frente' ? (
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
              ) : (
                <>
                  <Image className="h-6 w-6 text-muted-foreground mb-2" />
                  <span className="text-xs text-muted-foreground text-center">
                    Clique para enviar
                  </span>
                </>
              )}
            </div>
          )}
          <input
            ref={inputFrenteRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file, 'frente');
              e.target.value = '';
            }}
          />
        </div>

        {/* Verso do documento */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Verso</Label>
          {documentoVerso ? (
            renderPreview(documentoVerso, 'verso')
          ) : (
            <div
              className="border-2 border-dashed rounded-lg p-4 h-32 flex flex-col items-center justify-center cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => inputVersoRef.current?.click()}
            >
              {uploading === 'verso' ? (
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
              ) : (
                <>
                  <Image className="h-6 w-6 text-muted-foreground mb-2" />
                  <span className="text-xs text-muted-foreground text-center">
                    Clique para enviar
                  </span>
                </>
              )}
            </div>
          )}
          <input
            ref={inputVersoRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file, 'verso');
              e.target.value = '';
            }}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Formatos aceitos: JPG, PNG, WEBP ou PDF. Máximo 10MB por arquivo.
      </p>
    </div>
  );
}
