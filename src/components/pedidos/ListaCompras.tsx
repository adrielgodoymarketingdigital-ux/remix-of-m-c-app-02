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
      {/* Cabeçalho */}
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

      {/* Caderno */}
      <div className="rounded-xl overflow-hidden shadow-md border border-border">

        {/* Espiral do caderno */}
        <div className="bg-muted/50 border-b border-border flex items-center gap-0 px-3 py-1.5">
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="flex-1 flex justify-center">
              <div className="h-3 w-3 rounded-full border-2 border-muted-foreground/25 bg-background" />
            </div>
          ))}
        </div>

        {/* Corpo do caderno com linha vermelha lateral */}
        <div className="bg-[#fafaf7] dark:bg-[#1a1a16] flex">
          {/* Margem vermelha */}
          <div className="w-8 shrink-0 border-r-2 border-red-400/60" />

          {/* Conteúdo */}
          <div className="flex-1">

            {/* Formulário */}
            <form
              onSubmit={handleAdicionar}
              className="flex items-center gap-2 px-3 py-2.5 border-b border-blue-200/60 dark:border-blue-900/40"
            >
              <Input
                ref={inputNovoRef}
                placeholder="Adicionar item à lista..."
                value={novoNome}
                onChange={e => setNovoNome(e.target.value)}
                className="flex-1 h-7 text-sm border-0 rounded-none bg-transparent px-0 shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/40 font-['Patrick_Hand',_cursive]"
              />
              <Input
                placeholder="Qtd"
                value={novaQtd}
                onChange={e => setNovaQtd(e.target.value)}
                className="w-14 h-7 text-sm border-0 rounded-none bg-transparent px-0 shadow-none focus-visible:ring-0 text-center placeholder:text-muted-foreground/40"
              />
              <Button
                type="submit"
                size="icon"
                className="h-7 w-7 shrink-0 rounded-full"
                disabled={adicionando || !novoNome.trim()}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </form>

            {/* Itens */}
            {loading ? (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">Carregando...</div>
            ) : itens.length === 0 ? (
              <div className="px-3 py-10 text-center">
                <ShoppingCart className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground/50">Lista vazia. Adicione itens acima.</p>
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
                    <div className="px-3 py-1 bg-muted/30 border-y border-blue-200/60 dark:border-blue-900/40">
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
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
      <div className="flex items-center gap-2 px-3 py-2 border-b border-blue-200/60 dark:border-blue-900/40">
        <Input
          autoFocus
          value={editNome}
          onChange={e => onEditNomeChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") onConfirmarEdicao();
            if (e.key === "Escape") onCancelarEdicao();
          }}
          className="flex-1 h-7 text-sm border-0 border-b border-primary rounded-none bg-transparent px-0 shadow-none focus-visible:ring-0"
        />
        <Input
          value={editQtd}
          onChange={e => onEditQtdChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") onConfirmarEdicao();
            if (e.key === "Escape") onCancelarEdicao();
          }}
          className="w-14 h-7 text-sm border-0 border-b border-primary rounded-none bg-transparent px-0 shadow-none focus-visible:ring-0 text-center"
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
        "flex items-center gap-3 px-3 py-2.5 border-b border-blue-200/60 dark:border-blue-900/40",
        "group hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors",
        item.concluido && "opacity-55"
      )}
    >
      {/* Checkbox */}
      <button
        onClick={onToggle}
        className={cn(
          "h-4 w-4 rounded-sm border-2 shrink-0 flex items-center justify-center transition-colors",
          item.concluido
            ? "bg-primary border-primary"
            : "border-muted-foreground/35 hover:border-primary"
        )}
      >
        {item.concluido && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
      </button>

      {/* Nome */}
      <span
        className={cn(
          "flex-1 text-sm",
          item.concluido && "line-through text-muted-foreground"
        )}
      >
        {item.nome}
      </span>

      {/* Quantidade */}
      {item.quantidade && item.quantidade !== "1" && (
        <span className="text-xs text-muted-foreground/70 shrink-0 tabular-nums">
          {item.quantidade}
        </span>
      )}

      {/* Ações no hover */}
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
