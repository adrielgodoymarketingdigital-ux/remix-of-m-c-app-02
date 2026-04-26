import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useNovidadesAdmin } from "@/hooks/useNovidades";
import { TabelaNovidadesAdmin } from "@/components/admin/TabelaNovidadesAdmin";
import { DialogCadastroNovidade } from "@/components/admin/DialogCadastroNovidade";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Novidade, NovidadeInsert } from "@/types/novidade";
import { Sparkles, Plus, Search } from "lucide-react";

export default function AdminNovidades() {
  const { 
    novidades, 
    isLoading, 
    criarNovidade, 
    atualizarNovidade, 
    excluirNovidade, 
    toggleAtivo,
    uploadAsset 
  } = useNovidadesAdmin();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [novidadeParaEditar, setNovidadeParaEditar] = useState<Novidade | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'ativos' | 'inativos'>('todos');
  const [busca, setBusca] = useState('');

  const handleEditar = (novidade: Novidade) => {
    setNovidadeParaEditar(novidade);
    setDialogOpen(true);
  };

  const handleDuplicar = (novidade: Novidade) => {
    const duplicada: NovidadeInsert = {
      titulo: `${novidade.titulo} (cópia)`,
      descricao: novidade.descricao,
      thumbnail_url: novidade.thumbnail_url,
      conteudo: novidade.conteudo,
      publico_alvo: novidade.publico_alvo,
      ativo: false,
      data_inicio: new Date().toISOString(),
      prioridade: novidade.prioridade,
    };
    criarNovidade.mutate(duplicada);
  };

  const handleExcluir = (id: string) => {
    excluirNovidade.mutate(id);
  };

  const handleToggleAtivo = (id: string, ativo: boolean) => {
    toggleAtivo.mutate({ id, ativo });
  };

  const handleSalvar = (novidade: NovidadeInsert) => {
    criarNovidade.mutate(novidade);
  };

  const handleAtualizar = (id: string, updates: Partial<NovidadeInsert>) => {
    atualizarNovidade.mutate({ id, ...updates });
  };

  const handleNovoClick = () => {
    setNovidadeParaEditar(null);
    setDialogOpen(true);
  };

  // Filtrar novidades
  const novidadesFiltradas = novidades.filter(n => {
    const matchStatus = 
      filtroStatus === 'todos' ||
      (filtroStatus === 'ativos' && n.ativo) ||
      (filtroStatus === 'inativos' && !n.ativo);
    
    const matchBusca = 
      !busca ||
      n.titulo.toLowerCase().includes(busca.toLowerCase()) ||
      n.descricao?.toLowerCase().includes(busca.toLowerCase());

    return matchStatus && matchBusca;
  });

  return (
    <AppLayout>
      <main className="flex-1 p-4 sm:p-6 overflow-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-600">
              <Sparkles className="h-5 sm:h-6 w-5 sm:w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Novidades</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie as novidades exibidas
              </p>
            </div>
          </div>
          <Button onClick={handleNovoClick} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Nova Novidade
          </Button>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <Tabs value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as any)} className="w-full sm:w-auto">
            <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:flex">
              <TabsTrigger value="todos">Todos</TabsTrigger>
              <TabsTrigger value="ativos">Ativos</TabsTrigger>
              <TabsTrigger value="inativos">Inativos</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar novidades..."
              className="pl-9"
            />
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        )}

        {/* Tabela */}
        {!isLoading && (
          <TabelaNovidadesAdmin
            novidades={novidadesFiltradas}
            onEditar={handleEditar}
            onDuplicar={handleDuplicar}
            onExcluir={handleExcluir}
            onToggleAtivo={handleToggleAtivo}
          />
        )}

        {/* Dialog */}
        <DialogCadastroNovidade
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          novidadeParaEditar={novidadeParaEditar}
          onSalvar={handleSalvar}
          onAtualizar={handleAtualizar}
          onUploadImage={uploadAsset}
        />
      </main>
    </AppLayout>
  );
}
