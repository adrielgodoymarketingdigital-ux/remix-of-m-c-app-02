import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface TutorialVideo {
  id: string;
  categoria: string;
  titulo: string;
  descricao: string | null;
  youtube_url: string;
  video_upload_url: string | null;
  capa_url: string | null;
  tags: string[];
  ordem: number;
  ativo: boolean;
  created_at: string;
}

interface NovoVideo {
  categoria: string;
  titulo: string;
  descricao?: string;
  youtube_url: string;
  video_upload_url?: string | null;
  capa_url?: string | null;
  tags?: string[];
  ordem?: number;
}

export function extractYoutubeId(url: string): string | null {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([^?&/#]+)/
  );
  return match?.[1] ?? null;
}

export function isUploadedVideo(video: TutorialVideo): boolean {
  return !!video.video_upload_url;
}

export function useTutoriaisVideos() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ["tutoriais-videos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutoriais_videos")
        .select("*")
        .order("categoria")
        .order("ordem");
      if (error) throw error;
      return data as TutorialVideo[];
    },
  });

  const uploadVideo = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop();
    const fileName = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("tutoriais-videos")
      .upload(fileName, file, { cacheControl: "3600", upsert: false });
    if (error) throw error;
    const { data: urlData } = supabase.storage
      .from("tutoriais-videos")
      .getPublicUrl(fileName);
    return urlData.publicUrl;
  };

  const uploadCapa = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop();
    const fileName = `capas/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("tutoriais-videos")
      .upload(fileName, file, { cacheControl: "3600", upsert: false, contentType: file.type });
    if (error) throw error;
    const { data: urlData } = supabase.storage
      .from("tutoriais-videos")
      .getPublicUrl(fileName);
    return urlData.publicUrl;
  };

  const deleteStorageFile = async (url: string) => {
    try {
      const parts = url.split("/tutoriais-videos/");
      if (parts.length < 2) return;
      const filePath = parts[1];
      await supabase.storage.from("tutoriais-videos").remove([filePath]);
    } catch {
      // ignore storage delete errors
    }
  };

  const adicionarVideo = useMutation({
    mutationFn: async (video: NovoVideo) => {
      const { error } = await supabase.from("tutoriais_videos").insert(video);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tutoriais-videos"] });
      toast({ title: "Vídeo adicionado com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao adicionar vídeo", variant: "destructive" });
    },
  });

  const atualizarVideo = useMutation({
    mutationFn: async ({ id, ...dados }: Partial<TutorialVideo> & { id: string }) => {
      const { error } = await supabase
        .from("tutoriais_videos")
        .update(dados)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tutoriais-videos"] });
      toast({ title: "Vídeo atualizado" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar vídeo", variant: "destructive" });
    },
  });

  const deletarVideo = useMutation({
    mutationFn: async (id: string) => {
      // Find video to delete storage file if needed
      const video = videos.find((v) => v.id === id);
      if (video?.video_upload_url) {
        await deleteStorageFile(video.video_upload_url);
      }
      const { error } = await supabase
        .from("tutoriais_videos")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tutoriais-videos"] });
      toast({ title: "Vídeo removido" });
    },
    onError: () => {
      toast({ title: "Erro ao remover vídeo", variant: "destructive" });
    },
  });

  // Agrupar por categoria
  const categorias = videos.reduce<Record<string, TutorialVideo[]>>((acc, v) => {
    if (!acc[v.categoria]) acc[v.categoria] = [];
    acc[v.categoria].push(v);
    return acc;
  }, {});

  return {
    videos,
    categorias,
    isLoading,
    adicionarVideo,
    atualizarVideo,
    deletarVideo,
    uploadVideo,
    uploadCapa,
  };
}
