// Cartões de categoria do passo Itens (computador): Todos, cada categoria (mesmo agrupamento do
// catálogo público: as do catálogo, ou as do estoque quando não há nenhuma) e Sem categoria,
// com ícone, cor e contagem. O cartão ativo filtra a lista. Criar/editar usa o diálogo de
// categoria de sempre (DialogCategoriaCatalogo), com o seletor de ícone só aqui.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FolderOpen, LayoutGrid, MoreVertical, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DialogCategoriaCatalogo, type DadosCategoriaCatalogo } from "@/components/catalogo/DialogCategoriaCatalogo";
import { ID_SEM_CATEGORIA, type ContagemCategorias, type GrupoCategoria } from "@/lib/catalogo/listaItensDesktop";
import type { CategoriaCatalogo } from "@/types/catalogo";
import type { ItemCatalogo } from "@/types/catalogo-item";
import { cn } from "@/lib/utils";
import { corDaCategoria, IconeDaCategoria } from "./IconeCategoria";

/** Valor do filtro de categoria quando nenhuma está escolhida. */
export const TODAS_AS_CATEGORIAS = "todos";

interface CategoriasCatalogoDesktopProps {
  grupos: GrupoCategoria[];
  contagem: ContagemCategorias;
  ativa: string;
  onAtivar: (id: string) => void;
  /** catalogo_config.categoriasCatalogo (as que o lojista criou). */
  categoriasManuais: CategoriaCatalogo[];
  onCategoriasChange: (categorias: CategoriaCatalogo[]) => void;
  /** Itens que o diálogo oferece para vincular (mesma regra da tela antiga). */
  itensParaVincular: ItemCatalogo[];
}

export function CategoriasCatalogoDesktop(p: CategoriasCatalogoDesktopProps) {
  const { t } = useTranslation("catalogo", { keyPrefix: "telaDesktop.categorias" });
  const [dialogAberto, setDialogAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const doEstoque = p.grupos.length > 0 && p.grupos[0].origem === "estoque";

  const abrir = (id: string | null) => {
    setEditandoId(id);
    setDialogAberto(true);
  };

  // `...c` mantém o que o diálogo não mostra; o ícone vem do seletor (undefined = automático).
  const salvar = ({ nome, cor, itemIds, icone }: DadosCategoriaCatalogo) => {
    if (editandoId) {
      p.onCategoriasChange(
        p.categoriasManuais.map((c) => {
          if (c.id !== editandoId) return c;
          const { icone: _antigo, ...resto } = c;
          return { ...resto, nome, cor, itemIds, ...(icone ? { icone } : {}) };
        }),
      );
    } else {
      p.onCategoriasChange([...p.categoriasManuais, { id: crypto.randomUUID(), nome, cor, itemIds, ...(icone ? { icone } : {}) }]);
    }
    setDialogAberto(false);
  };

  const excluir = (id: string) => {
    p.onCategoriasChange(p.categoriasManuais.filter((c) => c.id !== id));
    if (p.ativa === id) p.onAtivar(TODAS_AS_CATEGORIAS);
  };

  return (
    <Card className="rounded-2xl p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
            <FolderOpen className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold">{t("titulo")}</h2>
            <p className="text-sm text-muted-foreground">{t("descricao")}</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => abrir(null)} className="h-10 shrink-0 rounded-xl">
          <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
          {t("nova")}
        </Button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1" role="listbox" aria-label={t("titulo")}>
        <CartaoCategoria
          ativo={p.ativa === TODAS_AS_CATEGORIAS}
          onClick={() => p.onAtivar(TODAS_AS_CATEGORIAS)}
          nome={t("todos")}
          contagem={t("itens", { count: p.contagem.total })}
          icone={<LayoutGrid className="h-5 w-5" aria-hidden="true" />}
          cor="#2563eb"
        />
        {p.grupos.map((g) => (
          <CartaoCategoria
            key={g.id}
            ativo={p.ativa === g.id}
            onClick={() => p.onAtivar(g.id)}
            nome={g.nome}
            contagem={t("itens", { count: p.contagem.porCategoria.get(g.id) ?? 0 })}
            icone={<IconeDaCategoria nome={g.nome} icone={g.icone} className="h-5 w-5" />}
            cor={g.cor}
            acoes={
              g.origem === "manual" ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label={t("acoes", { nome: g.nome })}>
                      <MoreVertical className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => abrir(g.id)}>
                      <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                      {t("editar")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => excluir(g.id)} className="text-destructive focus:text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                      {t("excluir")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null
            }
          />
        ))}
        {(p.contagem.semCategoria > 0 || p.ativa === ID_SEM_CATEGORIA) && (
          <CartaoCategoria
            ativo={p.ativa === ID_SEM_CATEGORIA}
            onClick={() => p.onAtivar(ID_SEM_CATEGORIA)}
            nome={t("semCategoria")}
            contagem={t("itens", { count: p.contagem.semCategoria })}
            icone={<Package className="h-5 w-5" aria-hidden="true" />}
            cor={null}
          />
        )}
      </div>

      {doEstoque && <p className="mt-3 text-xs text-muted-foreground">{t("doEstoque")}</p>}

      <DialogCategoriaCatalogo
        open={dialogAberto}
        onOpenChange={setDialogAberto}
        categoria={editandoId ? p.categoriasManuais.find((c) => c.id === editandoId) ?? null : null}
        itensDisponiveis={p.itensParaVincular}
        onSalvar={salvar}
        comIcone
      />
    </Card>
  );
}

function CartaoCategoria({
  ativo,
  onClick,
  nome,
  contagem,
  icone,
  cor,
  acoes,
}: {
  ativo: boolean;
  onClick: () => void;
  nome: string;
  contagem: string;
  icone: React.ReactNode;
  cor: string | null | undefined;
  acoes?: React.ReactNode;
}) {
  const hex = corDaCategoria(cor);
  return (
    <div
      className={cn(
        "flex min-w-[170px] max-w-[240px] shrink-0 items-center gap-3 rounded-xl border p-3 transition-colors",
        ativo ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-card hover:border-primary/40 hover:bg-muted/40",
      )}
    >
      <button type="button" role="option" aria-selected={ativo} onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span
          className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", !hex && "bg-muted text-muted-foreground")}
          style={hex ? { backgroundColor: `color-mix(in srgb, ${hex} 14%, transparent)`, color: hex } : undefined}
        >
          {icone}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{nome}</span>
          <span className="block text-xs text-muted-foreground">{contagem}</span>
        </span>
      </button>
      {acoes}
    </div>
  );
}
