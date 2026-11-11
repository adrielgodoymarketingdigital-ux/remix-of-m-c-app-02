import { useState } from "react";
import { ItemCatalogo } from "@/types/catalogo-item";
import { CategoriaCatalogo } from "@/types/catalogo";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Plus, Trash2, Edit2, FolderOpen } from "lucide-react";
import { DialogCategoriaCatalogo, type DadosCategoriaCatalogo } from "./DialogCategoriaCatalogo";

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

  const abrirDialogNovo = () => {
    setEditandoId(null);
    setDialogAberto(true);
  };

  const abrirDialogEditar = (cat: CategoriaCatalogo) => {
    setEditandoId(cat.id);
    setDialogAberto(true);
  };

  // `...c` mantém campos que este diálogo não mostra (ex.: `icone`, escolhido no computador).
  const salvar = ({ nome, cor, itemIds }: DadosCategoriaCatalogo) => {
    if (editandoId) {
      onChange(
        categorias.map((c) =>
          c.id === editandoId
            ? { ...c, nome, cor, itemIds }
            : c
        )
      );
    } else {
      const nova: CategoriaCatalogo = {
        id: crypto.randomUUID(),
        nome,
        cor,
        itemIds,
      };
      onChange([...categorias, nova]);
    }
    setDialogAberto(false);
  };

  const excluir = (id: string) => {
    onChange(categorias.filter((c) => c.id !== id));
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

      <DialogCategoriaCatalogo
        open={dialogAberto}
        onOpenChange={setDialogAberto}
        categoria={editandoId ? categorias.find((c) => c.id === editandoId) ?? null : null}
        itensDisponiveis={itensDisponiveis}
        onSalvar={salvar}
      />
    </div>
  );
}
