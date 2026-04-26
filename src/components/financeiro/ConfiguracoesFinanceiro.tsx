import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Settings, Plus, Trash2, Tag, RotateCcw } from "lucide-react";
import { useCategoriasDespesas } from "@/hooks/useCategoriasDespesas";

export function ConfiguracoesFinanceiro() {
  const {
    categoriasCustom,
    categoriasExcluidas,
    categoriaSistemaAtivas,
    criar,
    excluir,
    excluirSistema,
    restaurarSistema,
    loading,
  } = useCategoriasDespesas();
  const [novaCategoria, setNovaCategoria] = useState("");
  const [dialogCategorias, setDialogCategorias] = useState(false);

  const handleCriar = async () => {
    if (!novaCategoria.trim()) return;
    const ok = await criar(novaCategoria);
    if (ok) setNovaCategoria("");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Configurações</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setDialogCategorias(true)}>
            <Tag className="h-4 w-4 mr-2" />
            Categorias de Despesas
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialog: Categorias de Despesas */}
      <Dialog open={dialogCategorias} onOpenChange={setDialogCategorias}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Categorias de Despesas
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Gerencie as categorias disponíveis ao cadastrar despesas.
            </p>

            {/* Add new */}
            <div className="flex gap-2">
              <Input
                placeholder="Nova categoria..."
                value={novaCategoria}
                onChange={(e) => setNovaCategoria(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCriar()}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={handleCriar}
                disabled={loading || !novaCategoria.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* System categories */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Padrão do sistema
              </p>
              <div className="space-y-1.5">
                {categoriaSistemaAtivas().map((cat) => (
                  <div
                    key={cat}
                    className="flex items-center justify-between p-2 rounded-lg border bg-card"
                  >
                    <span className="text-sm">{cat}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => excluirSistema(cat)}
                      disabled={loading}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom categories */}
            {categoriasCustom.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Suas categorias
                </p>
                <div className="space-y-1.5">
                  {categoriasCustom.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between p-2 rounded-lg border bg-card"
                    >
                      <span className="text-sm">{cat.nome}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => excluir(cat.id)}
                        disabled={loading}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Excluded system categories - restore */}
            {categoriasExcluidas.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Categorias ocultas (clique para restaurar)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {categoriasExcluidas.map((cat) => (
                    <Badge
                      key={cat.id}
                      variant="outline"
                      className="text-xs cursor-pointer hover:bg-accent gap-1"
                      onClick={() => restaurarSistema(cat.id)}
                    >
                      <RotateCcw className="h-3 w-3" />
                      {cat.nome}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
