import { Play, PlayCircle, Trash2, Pencil, Upload } from "lucide-react";
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

function getThumbnail(video: TutorialVideo) {
  const uploaded = isUploadedVideo(video);
  const videoId = !uploaded ? extractYoutubeId(video.youtube_url) : null;
  const youtubeThumb = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;
  // Prioridade: capa personalizada > thumbnail do YouTube
  return { uploaded, thumbnail: video.capa_url || youtubeThumb };
}

export function CardVideoTutorial({ video, onClick, isAdmin, onEdit, onDelete }: CardVideoTutorialProps) {
  const { uploaded, thumbnail } = getThumbnail(video);

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

export function CardVideoTutorialDesktop({ video, onClick, isAdmin, onEdit, onDelete }: CardVideoTutorialProps) {
  const { uploaded, thumbnail } = getThumbnail(video);

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      <button onClick={onClick} className="flex w-full flex-1 flex-col text-left">
        <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-blue-950 to-blue-500">
          {thumbnail ? (
            <img src={thumbnail} alt={video.titulo} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-white">
              {uploaded ? <Upload className="h-10 w-10 opacity-80" /> : <PlayCircle className="h-11 w-11" />}
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
              <Play className="h-6 w-6 fill-white text-white" />
            </div>
          </div>
        </div>
        <div className="flex flex-1 flex-col p-4">
          <h4 className="line-clamp-2 text-sm font-semibold tracking-tight text-foreground">{video.titulo}</h4>
          {video.descricao && (
            <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-muted-foreground">{video.descricao}</p>
          )}
          {video.tags?.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1">
              {video.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="h-4 px-1.5 py-0 text-[10px]">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
          <div className="mt-auto pt-4">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-600 transition-colors group-hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400 dark:group-hover:bg-blue-500/20">
              <Play className="h-3.5 w-3.5" /> Assistir tutorial
            </span>
          </div>
        </div>
      </button>
      {isAdmin && (
        <div className="flex divide-x divide-border border-t border-border">
          <Button variant="ghost" size="sm" className="h-9 flex-1 rounded-none text-xs text-muted-foreground hover:text-primary" onClick={onEdit}>
            <Pencil className="mr-1 h-3 w-3" /> Editar
          </Button>
          <Button variant="ghost" size="sm" className="h-9 flex-1 rounded-none text-xs text-muted-foreground hover:text-destructive" onClick={onDelete}>
            <Trash2 className="mr-1 h-3 w-3" /> Excluir
          </Button>
        </div>
      )}
    </div>
  );
}
