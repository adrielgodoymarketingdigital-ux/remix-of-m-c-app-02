import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Check, X, Tag, Merge, ListTree } from "lucide-react";
import { useTiposServico } from "@/hooks/useTiposServico";
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
import { MesclarTiposServicoDialog } from "./MesclarTiposServicoDialog";
import { ServicosVinculadosDialog } from "./ServicosVinculadosDialog";

export function GerenciadorTiposServico() {
  const {
    tiposServico,
    contagens,
    loading,
    criar,
    atualizar,
    excluir,
    detectarGruposSimilares,
    mesclarTipos,
  } = useTiposServico();
  const [novoNome, setNovoNome] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editandoNome, setEditandoNome] = useState("");
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [mesclarAberto, setMesclarAberto] = useState(false);
  const [verVinculadosDe, setVerVinculadosDe] = useState<{ id: string; nome: string } | null>(null);

  const gruposDuplicados = useMemo(() => detectarGruposSimilares(), [detectarGruposSimilares]);

  const handleCriar = async () => {
    if (!novoNome.trim()) return;
    await criar(novoNome.trim());
    setNovoNome("");
  };

  const handleAtualizar = async () => {
    if (!editandoId || !editandoNome.trim()) return;
    await atualizar(editandoId, editandoNome.trim());
    setEditandoId(null);
    setEditandoNome("");
  };

  const handleExcluir = async () => {
    if (!excluindoId) return;
    await excluir(excluindoId);
    setExcluindoId(null);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Tipos de Serviço
              </CardTitle>
              <CardDescription>
                Cadastre tipos de serviço para configurar comissões por funcionário e vincular a serviços do catálogo.
              </CardDescription>
            </div>
            {gruposDuplicados.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setMesclarAberto(true)}>
                <Merge className="h-4 w-4 mr-1.5" />
                Mesclar duplicados ({gruposDuplicados.length})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Form to add */}
          <div className="flex gap-2">
            <Input
              placeholder="Ex: Troca de Tela, Reparo de Placa..."
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCriar()}
            />
            <Button onClick={handleCriar} disabled={!novoNome.trim()}>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </div>

          {/* List */}
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : tiposServico.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum tipo de serviço cadastrado. Adicione acima.
            </p>
          ) : (
            <div className="space-y-2">
              {tiposServico.map((tipo) => {
                const qtdVinculados = contagens[tipo.id] || 0;
                return (
                  <div
                    key={tipo.id}
                    className="flex items-center justify-between gap-2 rounded-md border p-3"
                  >
                    {editandoId === tipo.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          value={editandoNome}
                          onChange={(e) => setEditandoNome(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleAtualizar()}
                          className="h-8"
                          autoFocus
                        />
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleAtualizar}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => { setEditandoId(null); setEditandoNome(""); }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium truncate">{tipo.nome}</span>
                          <button
                            type="button"
                            onClick={() => qtdVinculados > 0 && setVerVinculadosDe({ id: tipo.id, nome: tipo.nome })}
                            disabled={qtdVinculados === 0}
                            className="shrink-0"
                            title={qtdVinculados > 0 ? "Ver serviços vinculados" : "Nenhum serviço vinculado"}
                          >
                            <Badge
                              variant={qtdVinculados > 0 ? "secondary" : "outline"}
                              className={qtdVinculados > 0 ? "text-xs gap-1 cursor-pointer hover:bg-secondary/80" : "text-xs gap-1 text-muted-foreground"}
                            >
                              <ListTree className="h-3 w-3" />
                              {qtdVinculados} serviço{qtdVinculados === 1 ? "" : "s"}
                            </Badge>
                          </button>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => { setEditandoId(tipo.id); setEditandoNome(tipo.nome); }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setExcluindoId(tipo.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!excluindoId} onOpenChange={(open) => !open && setExcluindoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tipo de serviço?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. As configurações de comissão por funcionário
              vinculadas a este tipo também serão removidas. Se o tipo estiver vinculado a
              serviços do catálogo ou a ordens de serviço, a exclusão será bloqueada — use
              "Mesclar duplicados" para transferir os vínculos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluir}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MesclarTiposServicoDialog
        open={mesclarAberto}
        onOpenChange={setMesclarAberto}
        grupos={gruposDuplicados}
        onConfirm={async (merges) => {
          for (const m of merges) {
            await mesclarTipos(m.sobreviventeId, m.duplicadosIds);
          }
        }}
      />

      <ServicosVinculadosDialog
        open={!!verVinculadosDe}
        onOpenChange={(open) => !open && setVerVinculadosDe(null)}
        tipoId={verVinculadosDe?.id ?? null}
        tipoNome={verVinculadosDe?.nome ?? ""}
      />
    </>
  );
}
