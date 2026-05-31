import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Pencil, Check, X, ShoppingCart, Eraser } from "lucide-react";
import { useListaCompras, ItemListaCompras } from "@/hooks/useListaCompras";
import { cn } from "@/lib/utils";

export function ListaCompras() {
  const { itens, loading, carregar, adicionarItem, toggleConcluido, editarItem, excluirItem, limparConcluidos } =
    useListaCompras();

  const [novoNome, setNovoNome] = useState("");
  const [novaQtd, setNovaQtd] = useState("");
  const [adicionando, setAdicionando] = useState(false);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editQtd, setEditQtd] = useState("");

  const inputNovoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const handleAdicionar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNome.trim()) return;
    setAdicionando(true);
    const ok = await adicionarItem(novoNome, novaQtd);
    setAdicionando(false);
    if (ok) {
      setNovoNome("");
      setNovaQtd("");
      inputNovoRef.current?.focus();
    }
  };

  const iniciarEdicao = (item: ItemListaCompras) => {
    setEditandoId(item.id);
    setEditNome(item.nome);
    setEditQtd(item.quantidade);
  };

  const confirmarEdicao = async () => {
    if (!editandoId || !editNome.trim()) return;
    await editarItem(editandoId, editNome, editQtd);
    setEditandoId(null);
  };

  const cancelarEdicao = () => setEditandoId(null);

  const pendentes = itens.filter(i => !i.concluido);
  const concluidos = itens.filter(i => i.concluido);

  return (
    <div className="max-w-xl mx-auto space-y-4">
      {/* Cabeçalho visual */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-lg">Lista de Compras</h2>
          {itens.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {pendentes.length} pendente{pendentes.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {concluidos.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive text-xs gap-1.5"
            onClick={limparConcluidos}
          >
            <Eraser className="h-3.5 w-3.5" />
            Limpar comprados
          </Button>
        )}
      </div>

      {/* Bloco de notas */}
      <div
        className="rounded-xl border-2 border-border shadow-sm overflow-hidden"
        style={{
          background: "repeating-linear-gradient(transparent, transparent 31px, hsl(var(--border)) 31px, hsl(var(--border)) 32px)",
        }}
      >
        {/* Topo do bloco */}
        <div className="bg-primary/10 border-b-2 border-primary/20 px-4 py-2 flex items-center gap-2">
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-2.5 w-2.5 rounded-full bg-primary/30" />
            ))}
          </div>
          <span className="text-xs font-medium text-primary/70 ml-1">
            {itens.length === 0 ? "Lista vazia" : `${itens.length} item${itens.length !== 1 ? "ns" : ""}`}
          </span>
        </div>

        {/* Formulário de adição */}
        <form onSubmit={handleAdicionar} className="px-4 pt-3 pb-2 border-b border-dashed border-border/60">
          <div className="flex gap-2">
            <Input
              ref={inputNovoRef}
              placeholder="Adicionar item..."
              value={novoNome}
              onChange={e => setNovoNome(e.target.value)}
              className="flex-1 h-8 text-sm border-0 border-b border-border rounded-none bg-transparent px-1 focus-visible:ring-0 focus-visible:border-primary placeholder:text-muted-foreground/50"
            />
            <Input
              placeholder="Qtd"
              value={novaQtd}
              onChange={e => setNovaQtd(e.target.value)}
              className="w-16 h-8 text-sm border-0 border-b border-border rounded-none bg-transparent px-1 focus-visible:ring-0 focus-visible:border-primary placeholder:text-muted-foreground/50 text-center"
            />
            <Button
              type="submit"
              size="icon"
              className="h-8 w-8 shrink-0"
              disabled={adicionando || !novoNome.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </form>

        {/* Lista de itens */}
        <div className="divide-y divide-dashed divide-border/40">
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : itens.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <ShoppingCart className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground/60">Nenhum item na lista ainda.</p>
              <p className="text-xs text-muted-foreground/40 mt-1">Digite acima para começar.</p>
            </div>
          ) : (
            <>
              {pendentes.map(item => (
                <ItemRow
                  key={item.id}
                  item={item}
                  editandoId={editandoId}
                  editNome={editNome}
                  editQtd={editQtd}
                  onToggle={() => toggleConcluido(item.id, item.concluido)}
                  onIniciarEdicao={() => iniciarEdicao(item)}
                  onExcluir={() => excluirItem(item.id)}
                  onEditNomeChange={setEditNome}
                  onEditQtdChange={setEditQtd}
                  onConfirmarEdicao={confirmarEdicao}
                  onCancelarEdicao={cancelarEdicao}
                />
              ))}

              {concluidos.length > 0 && (
                <>
                  <div className="px-4 py-1.5 bg-muted/30">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                      Comprado ({concluidos.length})
                    </span>
                  </div>
                  {concluidos.map(item => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      editandoId={editandoId}
                      editNome={editNome}
                      editQtd={editQtd}
                      onToggle={() => toggleConcluido(item.id, item.concluido)}
                      onIniciarEdicao={() => iniciarEdicao(item)}
                      onExcluir={() => excluirItem(item.id)}
                      onEditNomeChange={setEditNome}
                      onEditQtdChange={setEditQtd}
                      onConfirmarEdicao={confirmarEdicao}
                      onCancelarEdicao={cancelarEdicao}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface ItemRowProps {
  item: ItemListaCompras;
  editandoId: string | null;
  editNome: string;
  editQtd: string;
  onToggle: () => void;
  onIniciarEdicao: () => void;
  onExcluir: () => void;
  onEditNomeChange: (v: string) => void;
  onEditQtdChange: (v: string) => void;
  onConfirmarEdicao: () => void;
  onCancelarEdicao: () => void;
}

function ItemRow({
  item,
  editandoId,
  editNome,
  editQtd,
  onToggle,
  onIniciarEdicao,
  onExcluir,
  onEditNomeChange,
  onEditQtdChange,
  onConfirmarEdicao,
  onCancelarEdicao,
}: ItemRowProps) {
  const isEditando = editandoId === item.id;

  if (isEditando) {
    return (
      <div className="flex items-center gap-2 px-4 py-2">
        <Input
          autoFocus
          value={editNome}
          onChange={e => onEditNomeChange(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") onConfirmarEdicao(); if (e.key === "Escape") onCancelarEdicao(); }}
          className="flex-1 h-7 text-sm border-0 border-b border-primary rounded-none bg-transparent px-1 focus-visible:ring-0"
        />
        <Input
          value={editQtd}
          onChange={e => onEditQtdChange(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") onConfirmarEdicao(); if (e.key === "Escape") onCancelarEdicao(); }}
          className="w-14 h-7 text-sm border-0 border-b border-primary rounded-none bg-transparent px-1 focus-visible:ring-0 text-center"
        />
        <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600 hover:text-green-700" onClick={onConfirmarEdicao}>
          <Check className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground" onClick={onCancelarEdicao}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 group hover:bg-muted/20 transition-colors",
        item.concluido && "opacity-60"
      )}
    >
      {/* Checkbox estilo caderno */}
      <button
        onClick={onToggle}
        className={cn(
          "h-4 w-4 rounded-sm border-2 shrink-0 flex items-center justify-center transition-colors",
          item.concluido
            ? "bg-primary border-primary"
            : "border-muted-foreground/40 hover:border-primary"
        )}
      >
        {item.concluido && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
      </button>

      {/* Nome */}
      <span
        className={cn(
          "flex-1 text-sm leading-relaxed",
          item.concluido && "line-through text-muted-foreground"
        )}
      >
        {item.nome}
      </span>

      {/* Quantidade */}
      {item.quantidade && item.quantidade !== "1" && (
        <span className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded shrink-0">
          {item.quantidade}
        </span>
      )}

      {/* Ações - aparecem no hover */}
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={onIniciarEdicao}
        >
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={onExcluir}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
