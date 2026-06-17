import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Check, X, ShieldCheck } from "lucide-react";
import { useTiposGarantia } from "@/hooks/useTiposGarantia";
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DialogGerenciarTiposGarantia({ open, onOpenChange }: Props) {
  const { tiposGarantia, loading, criar, atualizar, excluir } = useTiposGarantia();
  const [novoNome, setNovoNome] = useState("");
  const [novoMeses, setNovoMeses] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editandoNome, setEditandoNome] = useState("");
  const [editandoMeses, setEditandoMeses] = useState("");
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  const handleCriar = async () => {
    const meses = parseInt(novoMeses, 10);
    if (!novoNome.trim() || !meses || meses <= 0) return;
    await criar(novoNome.trim(), meses);
    setNovoNome("");
    setNovoMeses("");
  };

  const handleAtualizar = async () => {
    const meses = parseInt(editandoMeses, 10);
    if (!editandoId || !editandoNome.trim() || !meses || meses <= 0) return;
    await atualizar(editandoId, editandoNome.trim(), meses);
    setEditandoId(null);
    setEditandoNome("");
    setEditandoMeses("");
  };

  const handleExcluir = async () => {
    if (!excluindoId) return;
    await excluir(excluindoId);
    setExcluindoId(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Tipos de Garantia
            </DialogTitle>
            <DialogDescription>
              Cadastre os tipos de garantia (ex: 3 meses, 6 meses, 1 ano) para selecionar rapidamente ao cadastrar um dispositivo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Nome (ex: Garantia 6 meses)"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCriar()}
                className="flex-1"
              />
              <Input
                type="number"
                min={1}
                placeholder="Meses"
                value={novoMeses}
                onChange={(e) => setNovoMeses(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCriar()}
                className="w-24"
              />
              <Button
                size="icon"
                onClick={handleCriar}
                disabled={!novoNome.trim() || !novoMeses}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : tiposGarantia.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum tipo de garantia cadastrado. Adicione acima.
              </p>
            ) : (
              <div className="space-y-2">
                {tiposGarantia.map((tipo) => (
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
                          className="h-8 flex-1"
                          autoFocus
                        />
                        <Input
                          type="number"
                          min={1}
                          value={editandoMeses}
                          onChange={(e) => setEditandoMeses(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleAtualizar()}
                          className="h-8 w-20"
                        />
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleAtualizar}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => { setEditandoId(null); setEditandoNome(""); setEditandoMeses(""); }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <span className="text-sm font-medium">{tipo.nome}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            ({tipo.meses} {tipo.meses === 1 ? "mês" : "meses"})
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => {
                              setEditandoId(tipo.id);
                              setEditandoNome(tipo.nome);
                              setEditandoMeses(String(tipo.meses));
                            }}
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
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!excluindoId} onOpenChange={(open) => !open && setExcluindoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tipo de garantia?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita.
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
