import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { extractYoutubeId, isUploadedVideo, type TutorialVideo } from "@/hooks/useTutoriaisVideos";

interface PlayerVideoTutorialProps {
  video: TutorialVideo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlayerVideoTutorial({ video, open, onOpenChange }: PlayerVideoTutorialProps) {
  if (!video) return null;

  const uploaded = isUploadedVideo(video);
  const videoId = !uploaded ? extractYoutubeId(video.youtube_url) : null;

  if (!uploaded && !videoId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="text-base">{video.titulo}</DialogTitle>
        </DialogHeader>
        <div className="aspect-video w-full">
          {uploaded ? (
            <video
              src={video.video_upload_url!}
              controls
              autoPlay
              className="w-full h-full bg-black"
            />
          ) : (
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
              title={video.titulo}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full border-0"
            />
          )}
        </div>
        {video.descricao && (
          <p className="px-4 pb-4 text-sm text-muted-foreground">{video.descricao}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
