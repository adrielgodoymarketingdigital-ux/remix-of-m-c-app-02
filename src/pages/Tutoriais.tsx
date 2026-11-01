import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ArrowLeft, Plus, Video, House, ChevronRight, SquarePlay } from "lucide-react";
import { useTutoriaisVideos, type TutorialVideo } from "@/hooks/useTutoriaisVideos";
import {
  CardCategoriaTutorial,
  CardCategoriaTutorialDesktop,
  getDescricaoCategoria,
  getNomeCategoria,
} from "@/components/tutoriais/CardCategoriaTutorial";
import { CardVideoTutorial, CardVideoTutorialDesktop } from "@/components/tutoriais/CardVideoTutorial";
import { IlustracaoTutoriais } from "@/components/tutoriais/IlustracaoTutoriais";
import { PlayerVideoTutorial } from "@/components/tutoriais/PlayerVideoTutorial";
import { DialogCadastroVideo } from "@/components/tutoriais/DialogCadastroVideo";
import { supabase } from "@/integrations/supabase/client";
import { useIsDesktop } from "@/hooks/use-mobile";

export default function Tutoriais() {
  const { videos, categorias, isLoading, adicionarVideo, atualizarVideo, deletarVideo, uploadVideo, uploadCapa } = useTutoriaisVideos();
  const [busca, setBusca] = useState("");
  const [categoriaAberta, setCategoriaAberta] = useState<string | null>(null);
  const [videoSelecionado, setVideoSelecionado] = useState<TutorialVideo | null>(null);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [videoEditando, setVideoEditando] = useState<TutorialVideo | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const isDesktop = useIsDesktop();

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

  const dialogs = (
    <>
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
    </>
  );

  const abrirNovoVideo = () => {
    setVideoEditando(null);
    setDialogAberto(true);
  };

  // Computador (a partir de 1024px): layout novo. Abaixo disso segue o layout de sempre.
  if (isDesktop) {
    return (
      <AppLayout>
        <div className="mx-auto w-full max-w-[1500px] overflow-x-hidden px-8 py-6">
          {/* Breadcrumb */}
          <nav aria-label="Navegação" className="mb-6 flex items-center gap-3 text-[13px] text-muted-foreground">
            <Link to="/dashboard" aria-label="Início" className="transition-colors hover:text-foreground">
              <House className="h-4 w-4" />
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            {categoriaAberta && !mostrandoBusca ? (
              <>
                <button onClick={() => setCategoriaAberta(null)} className="transition-colors hover:text-foreground">
                  Tutoriais
                </button>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="font-semibold text-foreground">{getNomeCategoria(categoriaAberta)}</span>
              </>
            ) : (
              <span className="font-semibold text-foreground">Tutoriais</span>
            )}
          </nav>

          {/* Hero */}
          <section className="flex items-center justify-between gap-8">
            <div className="min-w-0 max-w-[780px] flex-1">
              <div className="flex items-center gap-5">
                <div className="grid h-[66px] w-[66px] shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-700 to-blue-500 text-white shadow-lg shadow-blue-500/20">
                  <SquarePlay className="h-8 w-8" />
                </div>
                <div className="min-w-0">
                  <h1 className="mb-1.5 text-[30px] font-bold tracking-tight text-foreground">Tutoriais</h1>
                  <p className="text-[15px] text-muted-foreground">Aprenda a usar o sistema de forma simples e rápida.</p>
                </div>
              </div>
              <p className="mt-5 text-[13px] leading-[1.75] text-muted-foreground">
                Aqui você encontra vídeos tutoriais organizados por categoria para te ajudar a usar todas as funcionalidades do sistema.
                Selecione uma pasta abaixo ou use a barra de pesquisa para encontrar um tutorial específico.
              </p>
            </div>
            {/* Sem o botão (cliente comum), a ilustração ocupa o lado direito sozinha */}
            <div className="flex shrink-0 items-center gap-6">
              {isAdmin && (
                <button
                  onClick={abrirNovoVideo}
                  className="flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-blue-700 to-blue-500 px-5 py-3.5 text-[13px] font-semibold text-white shadow-lg shadow-blue-500/20 transition-opacity hover:opacity-90"
                >
                  <Plus className="h-4 w-4" /> Novo Vídeo
                </button>
              )}
              <IlustracaoTutoriais className="hidden min-[1280px]:block" />
            </div>
          </section>

          {/* Busca */}
          <div className="my-5 max-w-[960px] rounded-2xl border border-border bg-card p-2.5 shadow-sm">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5 transition-colors focus-within:border-primary/50">
              <Search className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Pesquisar tutoriais, categorias ou palavras-chave..."
                aria-label="Pesquisar tutoriais"
                className="w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="grid grid-cols-2 gap-x-3.5 gap-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[93px] rounded-2xl" />
              ))}
            </div>
          )}

          {/* Resultados da busca */}
          {mostrandoBusca && !isLoading && (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                {videosFiltrados.length} resultado{videosFiltrados.length !== 1 && "s"} para "{busca}"
              </p>
              {videosFiltrados.length === 0 ? (
                <div className="max-w-[960px] rounded-2xl border border-dashed border-border px-6 py-14 text-center">
                  <Search className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
                  <p className="text-muted-foreground">Nenhum tutorial encontrado</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 min-[1200px]:grid-cols-3 min-[1760px]:grid-cols-4">
                  {videosFiltrados.map((v) => (
                    <CardVideoTutorialDesktop
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
                <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
                  <Video className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
                  <p className="font-medium text-muted-foreground">Nenhum tutorial disponível</p>
                  <p className="mt-1 text-sm text-muted-foreground/70">Em breve novos conteúdos serão adicionados.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-3.5 gap-y-3">
                  {Object.entries(categorias).map(([cat, vids]) => (
                    <CardCategoriaTutorialDesktop
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
              <button
                onClick={() => setCategoriaAberta(null)}
                className="mb-4 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm text-foreground shadow-sm transition-colors hover:bg-muted"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar para categorias
              </button>
              <h2 className="text-xl font-bold tracking-tight text-foreground">{getNomeCategoria(categoriaAberta)}</h2>
              <p className="mb-5 mt-1 text-[13px] text-muted-foreground">
                {getDescricaoCategoria(categoriaAberta) ?? `${videosCategoria.length} ${videosCategoria.length === 1 ? "vídeo" : "vídeos"}`}
              </p>
              {videosCategoria.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
                  <p className="text-muted-foreground">Nenhum vídeo nesta categoria</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 min-[1200px]:grid-cols-3 min-[1760px]:grid-cols-4">
                  {videosCategoria.map((v) => (
                    <CardVideoTutorialDesktop
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
        </div>
        {dialogs}
      </AppLayout>
    );
  }

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
                {categoriaAberta && !mostrandoBusca ? getNomeCategoria(categoriaAberta) : "Tutoriais"}
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

        {dialogs}
      </div>
    </AppLayout>
  );
}
