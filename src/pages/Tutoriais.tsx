import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ArrowLeft, Plus, Video } from "lucide-react";
import { useTutoriaisVideos, type TutorialVideo } from "@/hooks/useTutoriaisVideos";
import { CardCategoriaTutorial } from "@/components/tutoriais/CardCategoriaTutorial";
import { CardVideoTutorial } from "@/components/tutoriais/CardVideoTutorial";
import { PlayerVideoTutorial } from "@/components/tutoriais/PlayerVideoTutorial";
import { DialogCadastroVideo } from "@/components/tutoriais/DialogCadastroVideo";
import { supabase } from "@/integrations/supabase/client";

export default function Tutoriais() {
  const { videos, categorias, isLoading, adicionarVideo, atualizarVideo, deletarVideo, uploadVideo, uploadCapa } = useTutoriaisVideos();
  const [busca, setBusca] = useState("");
  const [categoriaAberta, setCategoriaAberta] = useState<string | null>(null);
  const [videoSelecionado, setVideoSelecionado] = useState<TutorialVideo | null>(null);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [videoEditando, setVideoEditando] = useState<TutorialVideo | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
    };
    checkAdmin();
  }, []);

  // Filtrar vídeos pela busca
  const videosFiltrados = useMemo(() => {
    if (!busca.trim()) return null;
    const termo = busca.toLowerCase();
    return videos.filter(
      (v) =>
        v.titulo.toLowerCase().includes(termo) ||
        v.descricao?.toLowerCase().includes(termo) ||
        v.tags?.some((t) => t.toLowerCase().includes(termo)) ||
        v.categoria.toLowerCase().includes(termo)
    );
  }, [busca, videos]);

  const handleSalvarVideo = (dados: any) => {
    if (videoEditando) {
      atualizarVideo.mutate({ id: videoEditando.id, ...dados });
    } else {
      adicionarVideo.mutate(dados);
    }
    setVideoEditando(null);
  };

  const handleEditarVideo = (video: TutorialVideo) => {
    setVideoEditando(video);
    setDialogAberto(true);
  };

  const handleDeletarVideo = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este vídeo?")) {
      deletarVideo.mutate(id);
    }
  };

  const mostrandoBusca = videosFiltrados !== null;
  const videosCategoria = categoriaAberta ? categorias[categoriaAberta] ?? [] : [];

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {categoriaAberta && !mostrandoBusca && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => setCategoriaAberta(null)}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div>
              <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
                <Video className="h-5 w-5 text-primary" />
                {categoriaAberta && !mostrandoBusca ? categoriaAberta : "Tutoriais"}
              </h1>
              {categoriaAberta && !mostrandoBusca && (
                <button
                  onClick={() => setCategoriaAberta(null)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Voltar para categorias
                </button>
              )}
            </div>
          </div>
          {isAdmin && (
            <Button
              size="sm"
              onClick={() => {
                setVideoEditando(null);
                setDialogAberto(true);
              }}
              className="gap-1"
            >
              <Plus className="h-4 w-4" /> Novo Vídeo
            </Button>
          )}
        </div>

        {/* Texto explicativo */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          Aqui você encontra vídeos tutoriais organizados por categoria para te ajudar a usar todas as funcionalidades do sistema. Selecione uma pasta abaixo para ver os vídeos disponíveis, ou use a barra de pesquisa para encontrar um tutorial específico.
        </p>

        {/* Barra de busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
           <Input
            placeholder="Pesquisar tutoriais..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9 bg-muted/50 border-border"
          />
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl bg-white/5" />
            ))}
          </div>
        )}

        {/* Resultados da busca */}
        {mostrandoBusca && !isLoading && (
          <>
            <p className="text-sm text-muted-foreground">
              {videosFiltrados.length} resultado{videosFiltrados.length !== 1 && "s"} para "{busca}"
            </p>
            {videosFiltrados.length === 0 ? (
              <div className="text-center py-12">
                <Search className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum tutorial encontrado</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {videosFiltrados.map((v) => (
                  <CardVideoTutorial
                    key={v.id}
                    video={v}
                    onClick={() => setVideoSelecionado(v)}
                    isAdmin={isAdmin}
                    onEdit={() => handleEditarVideo(v)}
                    onDelete={() => handleDeletarVideo(v.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Categorias (pastas) */}
        {!mostrandoBusca && !categoriaAberta && !isLoading && (
          <>
            {Object.keys(categorias).length === 0 ? (
              <div className="text-center py-16">
                <Video className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">Nenhum tutorial disponível</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Em breve novos conteúdos serão adicionados.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(categorias).map(([cat, vids]) => (
                  <CardCategoriaTutorial
                    key={cat}
                    categoria={cat}
                    quantidadeVideos={vids.length}
                    onClick={() => setCategoriaAberta(cat)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Vídeos dentro de uma categoria */}
        {!mostrandoBusca && categoriaAberta && !isLoading && (
          <>
            {videosCategoria.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Nenhum vídeo nesta categoria</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {videosCategoria.map((v) => (
                  <CardVideoTutorial
                    key={v.id}
                    video={v}
                    onClick={() => setVideoSelecionado(v)}
                    isAdmin={isAdmin}
                    onEdit={() => handleEditarVideo(v)}
                    onDelete={() => handleDeletarVideo(v.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Player modal */}
        <PlayerVideoTutorial
          video={videoSelecionado}
          open={!!videoSelecionado}
          onOpenChange={(open) => !open && setVideoSelecionado(null)}
        />

        {/* Dialog cadastro admin */}
        <DialogCadastroVideo
          open={dialogAberto}
          onOpenChange={setDialogAberto}
          onSalvar={handleSalvarVideo}
          videoEdicao={videoEditando}
          categoriaPadrao={categoriaAberta ?? undefined}
          onUploadVideo={uploadVideo}
          onUploadCapa={uploadCapa}
        />
      </div>
    </AppLayout>
  );
}
