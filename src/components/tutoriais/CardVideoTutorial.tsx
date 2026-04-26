import { Play, Trash2, Pencil, Upload } from "lucide-react";
import { extractYoutubeId, isUploadedVideo, type TutorialVideo } from "@/hooks/useTutoriaisVideos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface CardVideoTutorialProps {
  video: TutorialVideo;
  onClick: () => void;
  isAdmin?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function CardVideoTutorial({ video, onClick, isAdmin, onEdit, onDelete }: CardVideoTutorialProps) {
  const uploaded = isUploadedVideo(video);
  const videoId = !uploaded ? extractYoutubeId(video.youtube_url) : null;
  const youtubeThumb = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;
  // Prioridade: capa personalizada > thumbnail do YouTube
  const thumbnail = video.capa_url || youtubeThumb;

  return (
    <div className="group rounded-xl border border-border bg-card overflow-hidden hover:border-border transition-all">
      <button onClick={onClick} className="w-full text-left">
        <div className="relative aspect-video bg-muted">
          {thumbnail ? (
            <img src={thumbnail} alt={video.titulo} className="w-full h-full object-cover" />
          ) : uploaded ? (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <Upload className="h-8 w-8 text-muted-foreground/50" />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Play className="h-10 w-10 text-muted-foreground" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Play className="h-6 w-6 text-white fill-white" />
            </div>
          </div>
        </div>
        <div className="p-3">
          <h4 className="text-sm font-medium text-foreground line-clamp-2">{video.titulo}</h4>
          {video.descricao && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{video.descricao}</p>
          )}
          {video.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {video.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </button>
      {isAdmin && (
        <div className="flex border-t border-border divide-x divide-border">
          <Button variant="ghost" size="sm" className="flex-1 rounded-none text-xs text-muted-foreground hover:text-primary h-8" onClick={onEdit}>
            <Pencil className="h-3 w-3 mr-1" /> Editar
          </Button>
          <Button variant="ghost" size="sm" className="flex-1 rounded-none text-xs text-muted-foreground hover:text-destructive h-8" onClick={onDelete}>
            <Trash2 className="h-3 w-3 mr-1" /> Excluir
          </Button>
        </div>
      )}
    </div>
  );
}
