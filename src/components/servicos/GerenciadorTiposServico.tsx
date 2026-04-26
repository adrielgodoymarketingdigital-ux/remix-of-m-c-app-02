import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Pencil, Trash2, Check, X, Tag } from "lucide-react";
import { useTiposServico, TipoServico } from "@/hooks/useTiposServico";
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

export function GerenciadorTiposServico() {
  const { tiposServico, loading, criar, atualizar, excluir } = useTiposServico();
  const [novoNome, setNovoNome] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editandoNome, setEditandoNome] = useState("");
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

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
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Tipos de Serviço
          </CardTitle>
          <CardDescription>
            Cadastre tipos de serviço para configurar comissões por funcionário.
          </CardDescription>
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
              {tiposServico.map((tipo) => (
                <div
                  key={tipo.id}
                  className="flex items-center justify-between rounded-md border p-3"
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
                      <span className="text-sm font-medium">{tipo.nome}</span>
                      <div className="flex items-center gap-1">
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!excluindoId} onOpenChange={(open) => !open && setExcluindoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tipo de serviço?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Comissões vinculadas a este tipo também serão removidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluir}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
