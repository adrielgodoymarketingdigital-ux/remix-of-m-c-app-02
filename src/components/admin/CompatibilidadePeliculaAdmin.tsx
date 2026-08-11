import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Layers, Plus, Trash2, Pencil, Loader2, X, ShieldAlert } from "lucide-react";
import { useCompatibilidadePeliculaAdmin } from "@/hooks/useCompatibilidadePelicula";
import { SeletorMarcaModeloCelular } from "@/components/admin/SeletorMarcaModeloCelular";

export function CompatibilidadePeliculaAdmin() {
  const {
    grupos,
    isLoading,
    criarGrupo,
    renomearGrupo,
    excluirGrupo,
    adicionarModelo,
    removerModelo,
  } = useCompatibilidadePeliculaAdmin();

  const [dialogNovoGrupo, setDialogNovoGrupo] = useState(false);
  const [nomeNovoGrupo, setNomeNovoGrupo] = useState("");

  const [grupoParaRenomear, setGrupoParaRenomear] = useState<{ id: string; nome: string } | null>(null);
  const [novoNome, setNovoNome] = useState("");

  const [grupoParaExcluir, setGrupoParaExcluir] = useState<{ id: string; nome: string } | null>(null);

  const [marcaSelecao, setMarcaSelecao] = useState<Record<string, string>>({});
  const [modeloSelecao, setModeloSelecao] = useState<Record<string, string>>({});

  const handleCriarGrupo = () => {
    if (!nomeNovoGrupo.trim()) return;
    criarGrupo.mutate(nomeNovoGrupo, {
      onSuccess: () => {
        setDialogNovoGrupo(false);
        setNomeNovoGrupo("");
      },
    });
  };

  const handleRenomear = () => {
    if (!grupoParaRenomear || !novoNome.trim()) return;
    renomearGrupo.mutate(
      { id: grupoParaRenomear.id, nome: novoNome },
      { onSuccess: () => setGrupoParaRenomear(null) },
    );
  };

  const handleAdicionarModelo = (grupoId: string) => {
    const marca = marcaSelecao[grupoId];
    const modelo = modeloSelecao[grupoId];
    if (!marca || !modelo) return;

    adicionarModelo.mutate(
      { grupoId, marca, modelo },
      {
        onSuccess: () => {
          setMarcaSelecao((prev) => ({ ...prev, [grupoId]: "" }));
          setModeloSelecao((prev) => ({ ...prev, [grupoId]: "" }));
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-600">
            <Layers className="h-5 sm:h-6 w-5 sm:w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Compatibilidade de Película</h1>
            <p className="text-sm text-muted-foreground">
              Grupos de modelos compatíveis, visíveis a todos os clientes do MecApp
            </p>
          </div>
        </div>
        <Button onClick={() => setDialogNovoGrupo(true)} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Novo Grupo
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Carregando grupos...</span>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && grupos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center border rounded-lg bg-muted/20">
          <div className="p-4 rounded-full bg-muted">
            <Layers className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Nenhum grupo cadastrado</p>
            <p className="text-sm text-muted-foreground mt-1">
              Clique em "Novo Grupo" para criar o primeiro grupo de compatibilidade.
            </p>
          </div>
          <Button onClick={() => setDialogNovoGrupo(true)} variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Criar primeiro grupo
          </Button>
        </div>
      )}

      {/* Lista de grupos */}
      {!isLoading && grupos.length > 0 && (
        <Accordion type="multiple" className="space-y-3">
          {grupos.map((grupo) => (
            <AccordionItem
              key={grupo.id}
              value={grupo.id}
              className="border rounded-xl px-4 bg-card"
            >
              <div className="flex items-center gap-2">
                <AccordionTrigger className="hover:no-underline flex-1 py-4">
                  <div className="flex items-center gap-3 text-left">
                    <span className="font-semibold">{grupo.nome}</span>
                    <Badge variant="secondary">{grupo.modelos.length} modelo{grupo.modelos.length !== 1 ? "s" : ""}</Badge>
                  </div>
                </AccordionTrigger>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => {
                    setGrupoParaRenomear({ id: grupo.id, nome: grupo.nome });
                    setNovoNome(grupo.nome);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setGrupoParaExcluir({ id: grupo.id, nome: grupo.nome })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <AccordionContent className="pb-4 space-y-4">
                {/* Modelos do grupo */}
                {grupo.modelos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum modelo neste grupo ainda.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {grupo.modelos.map((m) => (
                      <Badge key={m.id} variant="outline" className="gap-1.5 pl-3 pr-1.5 py-1">
                        {m.marca} {m.modelo}
                        <button
                          type="button"
                          onClick={() => removerModelo.mutate(m.id)}
                          className="rounded-full hover:bg-destructive/10 hover:text-destructive p-0.5"
                          aria-label={`Remover ${m.marca} ${m.modelo}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Adicionar modelo */}
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end pt-2 border-t">
                  <div className="flex-1">
                    <SeletorMarcaModeloCelular
                      marca={marcaSelecao[grupo.id] ?? ""}
                      modelo={modeloSelecao[grupo.id] ?? ""}
                      onChangeMarca={(marca) => setMarcaSelecao((prev) => ({ ...prev, [grupo.id]: marca }))}
                      onChangeModelo={(modelo) => setModeloSelecao((prev) => ({ ...prev, [grupo.id]: modelo }))}
                    />
                  </div>
                  <Button
                    onClick={() => handleAdicionarModelo(grupo.id)}
                    disabled={!marcaSelecao[grupo.id] || !modeloSelecao[grupo.id] || adicionarModelo.isPending}
                    className="shrink-0"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* Dialog: Novo grupo */}
      <Dialog open={dialogNovoGrupo} onOpenChange={setDialogNovoGrupo}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-blue-600" />
              Novo Grupo de Compatibilidade
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="novo-grupo-nome" className="text-xs font-semibold">
              Nome do grupo
            </Label>
            <Input
              id="novo-grupo-nome"
              placeholder="Ex: Película Universal 6.1&quot;"
              value={nomeNovoGrupo}
              onChange={(e) => setNomeNovoGrupo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCriarGrupo()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogNovoGrupo(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCriarGrupo} disabled={!nomeNovoGrupo.trim() || criarGrupo.isPending}>
              {criarGrupo.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar grupo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Renomear grupo */}
      <Dialog open={!!grupoParaRenomear} onOpenChange={(open) => !open && setGrupoParaRenomear(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-blue-600" />
              Renomear Grupo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="renomear-grupo-nome" className="text-xs font-semibold">
              Nome do grupo
            </Label>
            <Input
              id="renomear-grupo-nome"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRenomear()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrupoParaRenomear(null)}>
              Cancelar
            </Button>
            <Button onClick={handleRenomear} disabled={!novoNome.trim() || renomearGrupo.isPending}>
              {renomearGrupo.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alert: Excluir grupo */}
      <AlertDialog open={!!grupoParaExcluir} onOpenChange={(open) => !open && setGrupoParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Excluir grupo "{grupoParaExcluir?.nome}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação também remove todos os modelos vinculados a este grupo e não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (grupoParaExcluir) {
                  excluirGrupo.mutate(grupoParaExcluir.id);
                  setGrupoParaExcluir(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
