// Diálogo de categoria do catálogo (nome, cor e itens vinculados). Saiu de dentro do
// GerenciadorCategoriasCatalogo SEM mudar o JSX, para o computador reaproveitar; o celular e o
// tablet continuam com o mesmo diálogo. `comIcone` (só o computador) acrescenta o seletor de ícone.
// Quem abre deve trocar a `key` a cada abertura: o formulário nasce dos dados da categoria.
import { useState } from "react";
import { ItemCatalogo } from "@/types/catalogo-item";
import { CategoriaCatalogo } from "@/types/catalogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Package, Smartphone } from "lucide-react";
import { SeletorIconeCategoria } from "@/components/catalogo/desktop/IconeCategoria";

export interface DadosCategoriaCatalogo {
  nome: string;
  cor: string;
  itemIds: string[];
  /** Só vem do computador. undefined = escolha automática pelo nome. */
  icone?: string;
}

interface DialogCategoriaCatalogoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = nova categoria. */
  categoria: CategoriaCatalogo | null;
  itensDisponiveis: ItemCatalogo[];
  onSalvar: (dados: DadosCategoriaCatalogo) => void;
  comIcone?: boolean;
}

export function DialogCategoriaCatalogo({
  open,
  onOpenChange,
  categoria,
  itensDisponiveis,
  onSalvar,
  comIcone = false,
}: DialogCategoriaCatalogoProps) {
  const editandoId = categoria?.id ?? null;
  const [nomeCategoria, setNomeCategoria] = useState(categoria?.nome ?? "");
  const [corCategoria, setCorCategoria] = useState(categoria?.cor || "#3B82F6");
  const [itensSelecionados, setItensSelecionados] = useState<string[]>(categoria?.itemIds ?? []);
  const [icone, setIcone] = useState<string | undefined>(categoria?.icone);

  const salvar = () => {
    if (!nomeCategoria.trim()) return;
    onSalvar({
      nome: nomeCategoria.trim(),
      cor: corCategoria,
      itemIds: itensSelecionados,
      ...(comIcone ? { icone } : {}),
    });
  };

  const toggleItem = (id: string) => {
    setItensSelecionados((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editandoId ? "Editar Categoria" : "Nova Categoria"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1 space-y-2">
                <Label>Nome da Categoria</Label>
                <Input
                  value={nomeCategoria}
                  onChange={(e) => setNomeCategoria(e.target.value)}
                  placeholder="Ex: Celulares, Acessórios..."
                />
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <Input
                  type="color"
                  value={corCategoria}
                  onChange={(e) => setCorCategoria(e.target.value)}
                  className="w-14 h-9 p-1 cursor-pointer"
                />
              </div>
            </div>

            {comIcone && (
              <SeletorIconeCategoria
                valor={icone}
                nomeCategoria={nomeCategoria}
                cor={corCategoria}
                onChange={setIcone}
              />
            )}

            <div className="space-y-2">
              <Label>Vincular Itens ({itensSelecionados.length} selecionados)</Label>
              <div className="max-h-[300px] overflow-y-auto space-y-1 border rounded-lg p-2">
                {itensDisponiveis.map((item) => {
                  const isSelected = itensSelecionados.includes(item.id);
                  const foto = item.foto_url || item.fotos?.[0];
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleItem(item.id)}
                      className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <Checkbox
                        checked={isSelected}
                        onClick={(event) => event.stopPropagation()}
                        onCheckedChange={() => toggleItem(item.id)}
                      />
                      <div className="w-8 h-8 rounded bg-muted flex-shrink-0 overflow-hidden">
                        {foto ? (
                          <img src={foto} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            {item.tipo_item === "dispositivo" ? (
                              <Smartphone className="w-4 h-4 text-muted-foreground/30" />
                            ) : (
                              <Package className="w-4 h-4 text-muted-foreground/30" />
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.tipo_item === "dispositivo"
                            ? item.tipo_dispositivo
                            : item.tipo_item === "produto"
                            ? "Produto"
                            : "Peça"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={!nomeCategoria.trim()}>
              {editandoId ? "Salvar" : "Criar Categoria"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}
