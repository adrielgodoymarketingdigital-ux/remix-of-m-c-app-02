import { useState } from "react";
import { ItemCatalogo } from "@/types/catalogo-item";
import { CategoriaCatalogo } from "@/types/catalogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Plus, Trash2, Edit2, FolderOpen, Package, Smartphone } from "lucide-react";

interface GerenciadorCategoriasCatalogoProps {
  categorias: CategoriaCatalogo[];
  itensDisponiveis: ItemCatalogo[];
  onChange: (categorias: CategoriaCatalogo[]) => void;
}

export function GerenciadorCategoriasCatalogo({
  categorias,
  itensDisponiveis,
  onChange,
}: GerenciadorCategoriasCatalogoProps) {
  const [dialogAberto, setDialogAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeCategoria, setNomeCategoria] = useState("");
  const [corCategoria, setCorCategoria] = useState("#3B82F6");
  const [itensSelecionados, setItensSelecionados] = useState<string[]>([]);

  const abrirDialogNovo = () => {
    setEditandoId(null);
    setNomeCategoria("");
    setCorCategoria("#3B82F6");
    setItensSelecionados([]);
    setDialogAberto(true);
  };

  const abrirDialogEditar = (cat: CategoriaCatalogo) => {
    setEditandoId(cat.id);
    setNomeCategoria(cat.nome);
    setCorCategoria(cat.cor || "#3B82F6");
    setItensSelecionados(cat.itemIds);
    setDialogAberto(true);
  };

  const salvar = () => {
    if (!nomeCategoria.trim()) return;

    if (editandoId) {
      onChange(
        categorias.map((c) =>
          c.id === editandoId
            ? { ...c, nome: nomeCategoria.trim(), cor: corCategoria, itemIds: itensSelecionados }
            : c
        )
      );
    } else {
      const nova: CategoriaCatalogo = {
        id: crypto.randomUUID(),
        nome: nomeCategoria.trim(),
        cor: corCategoria,
        itemIds: itensSelecionados,
      };
      onChange([...categorias, nova]);
    }
    setDialogAberto(false);
  };

  const excluir = (id: string) => {
    onChange(categorias.filter((c) => c.id !== id));
  };

  const toggleItem = (id: string) => {
    setItensSelecionados((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const getItemNome = (id: string) => {
    const item = itensDisponiveis.find((i) => i.id === id);
    return item?.nome || "Item removido";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Categorias do Catálogo</Label>
        </div>
        <Button variant="outline" size="sm" onClick={abrirDialogNovo}>
          <Plus className="w-4 h-4 mr-1" />
          Nova Categoria
        </Button>
      </div>

      {categorias.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground border border-dashed rounded-lg">
          <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhuma categoria criada</p>
          <p className="text-xs mt-1">
            Crie categorias para organizar os itens do catálogo
          </p>
        </div>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {categorias.map((cat) => (
            <AccordionItem
              key={cat.id}
              value={cat.id}
              className="border rounded-lg px-3"
            >
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-2 flex-1">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.cor || "#3B82F6" }}
                  />
                  <span className="font-medium text-sm">{cat.nome}</span>
                  <Badge variant="secondary" className="text-xs ml-auto mr-2">
                    {cat.itemIds.length} itens
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <div className="space-y-2">
                  {cat.itemIds.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {cat.itemIds.map((id) => (
                        <Badge key={id} variant="outline" className="text-xs">
                          {getItemNome(id)}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Nenhum item vinculado
                    </p>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => abrirDialogEditar(cat)}
                    >
                      <Edit2 className="w-3 h-3 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => excluir(cat.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Excluir
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
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
            <Button variant="outline" onClick={() => setDialogAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={!nomeCategoria.trim()}>
              {editandoId ? "Salvar" : "Criar Categoria"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
