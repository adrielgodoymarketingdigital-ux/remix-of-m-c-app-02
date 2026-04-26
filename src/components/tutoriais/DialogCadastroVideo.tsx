import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Youtube, Loader2, Image as ImageIcon, X } from "lucide-react";
import type { TutorialVideo } from "@/hooks/useTutoriaisVideos";

interface DialogCadastroVideoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSalvar: (dados: {
    categoria: string;
    titulo: string;
    descricao?: string;
    youtube_url: string;
    video_upload_url?: string | null;
    capa_url?: string | null;
    tags?: string[];
    ordem?: number;
  }) => void;
  videoEdicao?: TutorialVideo | null;
  categoriaPadrao?: string;
  onUploadVideo?: (file: File) => Promise<string>;
  onUploadCapa?: (file: File) => Promise<string>;
}

export function DialogCadastroVideo({
  open,
  onOpenChange,
  onSalvar,
  videoEdicao,
  categoriaPadrao,
  onUploadVideo,
  onUploadCapa,
}: DialogCadastroVideoProps) {
  const [categoria, setCategoria] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [ordem, setOrdem] = useState(0);
  const [tipoVideo, setTipoVideo] = useState<"youtube" | "upload">("youtube");
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [capaUrl, setCapaUrl] = useState<string | null>(null);
  const [uploadingCapa, setUploadingCapa] = useState(false);
  const capaInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (videoEdicao) {
      setCategoria(videoEdicao.categoria);
      setTitulo(videoEdicao.titulo);
      setDescricao(videoEdicao.descricao ?? "");
      setYoutubeUrl(videoEdicao.youtube_url);
      setTagsStr(videoEdicao.tags?.join(", ") ?? "");
      setOrdem(videoEdicao.ordem);
      setCapaUrl(videoEdicao.capa_url ?? null);
      if (videoEdicao.video_upload_url) {
        setTipoVideo("upload");
        setUploadUrl(videoEdicao.video_upload_url);
        setFileName("Vídeo enviado anteriormente");
      } else {
        setTipoVideo("youtube");
        setUploadUrl(null);
        setFileName("");
      }
    } else {
      setCategoria(categoriaPadrao ?? "");
      setTitulo("");
      setDescricao("");
      setYoutubeUrl("");
      setTagsStr("");
      setOrdem(0);
      setTipoVideo("youtube");
      setUploadUrl(null);
      setFileName("");
      setCapaUrl(null);
    }
  }, [videoEdicao, open, categoriaPadrao]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadVideo) return;

    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      alert("Arquivo muito grande. O tamanho máximo é 100MB.");
      return;
    }

    setUploading(true);
    setFileName(file.name);
    try {
      const url = await onUploadVideo(file);
      setUploadUrl(url);
    } catch {
      alert("Erro ao fazer upload do vídeo. Tente novamente.");
      setFileName("");
      setUploadUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const handleCapaChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadCapa) return;
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      alert("Imagem muito grande. O tamanho máximo é 5MB.");
      return;
    }
    setUploadingCapa(true);
    try {
      const url = await onUploadCapa(file);
      setCapaUrl(url);
    } catch {
      alert("Erro ao enviar imagem de capa.");
    } finally {
      setUploadingCapa(false);
      if (capaInputRef.current) capaInputRef.current.value = "";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoria.trim() || !titulo.trim()) return;

    if (tipoVideo === "youtube" && !youtubeUrl.trim()) return;
    if (tipoVideo === "upload" && !uploadUrl) return;

    onSalvar({
      categoria: categoria.trim(),
      titulo: titulo.trim(),
      descricao: descricao.trim() || undefined,
      youtube_url: tipoVideo === "youtube" ? youtubeUrl.trim() : "",
      video_upload_url: tipoVideo === "upload" ? uploadUrl : null,
      capa_url: capaUrl,
      tags: tagsStr
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
      ordem,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {videoEdicao ? "Editar Vídeo" : "Novo Vídeo Tutorial"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Categoria / Pasta</Label>
            <Input
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="Ex: Dashboard, PDV, Ordem de Serviço"
              required
            />
          </div>
          <div>
            <Label>Título do Vídeo</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Como cadastrar um cliente"
              required
            />
          </div>

          {/* Tipo de vídeo */}
          <div>
            <Label>Origem do Vídeo</Label>
            <div className="flex gap-2 mt-1">
              <Button
                type="button"
                variant={tipoVideo === "youtube" ? "default" : "outline"}
                size="sm"
                onClick={() => setTipoVideo("youtube")}
                className="gap-1.5"
              >
                <Youtube className="h-4 w-4" /> YouTube
              </Button>
              <Button
                type="button"
                variant={tipoVideo === "upload" ? "default" : "outline"}
                size="sm"
                onClick={() => setTipoVideo("upload")}
                className="gap-1.5"
              >
                <Upload className="h-4 w-4" /> Computador
              </Button>
            </div>
          </div>

          {tipoVideo === "youtube" ? (
            <div>
              <Label>URL do YouTube</Label>
              <Input
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                required={tipoVideo === "youtube"}
              />
            </div>
          ) : (
            <div>
              <Label>Arquivo de Vídeo</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <div
                onClick={() => !uploading && fileInputRef.current?.click()}
                className="mt-1 border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              >
                {uploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                    <p className="text-sm text-muted-foreground">Enviando vídeo...</p>
                  </div>
                ) : uploadUrl ? (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-8 w-8 text-primary" />
                    <p className="text-sm text-foreground font-medium">{fileName}</p>
                    <p className="text-xs text-muted-foreground">Clique para trocar o vídeo</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Clique para selecionar um vídeo</p>
                    <p className="text-xs text-muted-foreground">MP4, MOV, WebM (máx. 100MB)</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Capa personalizada (opcional) */}
          <div>
            <Label>Foto de Capa (opcional)</Label>
            <input
              ref={capaInputRef}
              type="file"
              accept="image/*"
              onChange={handleCapaChange}
              className="hidden"
            />
            {capaUrl ? (
              <div className="mt-1 relative rounded-lg overflow-hidden border border-border">
                <img src={capaUrl} alt="Capa" className="w-full aspect-video object-cover" />
                <div className="absolute inset-x-0 bottom-0 flex gap-2 p-2 bg-gradient-to-t from-black/70 to-transparent">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => capaInputRef.current?.click()}
                    disabled={uploadingCapa}
                  >
                    Trocar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => setCapaUrl(null)}
                  >
                    <X className="h-3 w-3 mr-1" /> Remover
                  </Button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => !uploadingCapa && capaInputRef.current?.click()}
                className="mt-1 border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
              >
                {uploadingCapa ? (
                  <div className="flex flex-col items-center gap-1">
                    <Loader2 className="h-6 w-6 text-primary animate-spin" />
                    <p className="text-xs text-muted-foreground">Enviando capa...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Clique para enviar uma capa</p>
                    <p className="text-xs text-muted-foreground">JPG, PNG (máx. 5MB) — se vazio, usa a do YouTube</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Breve descrição do vídeo"
              rows={2}
            />
          </div>
          <div>
            <Label>Tags (separadas por vírgula)</Label>
            <Input
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              placeholder="venda, recibo, cliente, cadastro"
            />
          </div>
          <div>
            <Label>Ordem</Label>
            <Input
              type="number"
              value={ordem}
              onChange={(e) => setOrdem(Number(e.target.value))}
              min={0}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={uploading || (tipoVideo === "upload" && !uploadUrl)}
            >
              {videoEdicao ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
