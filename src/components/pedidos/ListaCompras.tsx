import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, Trash2, Pencil, Check, X, ShoppingCart,
  Eraser, ArrowLeft, ShoppingBag, MoreVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useListasCompras, useItensLista, ListaCompras as TLista, ItemLista } from "@/hooks/useListaCompras";
import { cn } from "@/lib/utils";

// ─── Tela principal: grade de cards ────────────────────────────────────────

export function ListaCompras() {
  const { listas, loading, carregar, criarLista, renomearLista, excluirLista } = useListasCompras();
  const [listaAberta, setListaAberta] = useState<TLista | null>(null);
  const [novoNome, setNovoNome] = useState("");
  const [criando, setCriando] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [renomeandoId, setRenomeandoId] = useState<string | null>(null);
  const [renomeandoValor, setRenomeandoValor] = useState("");
  const [excluindoLista, setExcluindoLista] = useState<TLista | null>(null);

  useEffect(() => { carregar(); }, [carregar]);

  const handleCriar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNome.trim()) return;
    setCriando(true);
    const nova = await criarLista(novoNome);
    setCriando(false);
    if (nova) {
      setNovoNome("");
      setMostrarForm(false);
      setListaAberta(nova);
    }
  };

  const handleRenomear = async () => {
    if (!renomeandoId || !renomeandoValor.trim()) return;
    await renomearLista(renomeandoId, renomeandoValor);
    setRenomeandoId(null);
  };

  const handleExcluir = async () => {
    if (!excluindoLista) return;
    await excluirLista(excluindoLista.id);
    setExcluindoLista(null);
  };

  if (listaAberta) {
    return (
      <TelaLista
        lista={listaAberta}
        onVoltar={() => { setListaAberta(null); carregar(); }}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-lg">Listas de Compras</h2>
          {listas.length > 0 && (
            <span className="text-xs text-muted-foreground">{listas.length} lista{listas.length !== 1 ? "s" : ""}</span>
          )}
        </div>
        <Button size="sm" onClick={() => setMostrarForm(v => !v)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Nova lista
        </Button>
      </div>

      {/* Form nova lista */}
      {mostrarForm && (
        <form onSubmit={handleCriar} className="flex gap-2 p-3 rounded-lg border bg-muted/30">
          <Input
            autoFocus
            placeholder="Nome da lista... ex: Peças da semana"
            value={novoNome}
            onChange={e => setNovoNome(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={criando || !novoNome.trim()}>
            {criando ? "Criando..." : "Criar"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => { setMostrarForm(false); setNovoNome(""); }}>
            <X className="h-4 w-4" />
          </Button>
        </form>
      )}

      {/* Grade de cards */}
      {loading ? (
        <div className="text-center py-10 text-muted-foreground text-sm">Carregando...</div>
      ) : listas.length === 0 ? (
        <div className="text-center py-14 text-muted-foreground">
          <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">Nenhuma lista criada ainda</p>
          <p className="text-sm opacity-70 mt-1">Clique em "Nova lista" para começar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {listas.map(lista => (
            <CardLista
              key={lista.id}
              lista={lista}
              renomeandoId={renomeandoId}
              renomeandoValor={renomeandoValor}
              onAbrir={() => setListaAberta(lista)}
              onIniciarRenomear={() => { setRenomeandoId(lista.id); setRenomeandoValor(lista.nome); }}
              onRenomearChange={setRenomeandoValor}
              onConfirmarRenomear={handleRenomear}
              onCancelarRenomear={() => setRenomeandoId(null)}
              onExcluir={() => setExcluindoLista(lista)}
            />
          ))}
        </div>
      )}

      {/* Confirmação excluir lista */}
      <AlertDialog open={!!excluindoLista} onOpenChange={o => { if (!o) setExcluindoLista(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lista?</AlertDialogTitle>
            <AlertDialogDescription>
              A lista <strong>"{excluindoLista?.nome}"</strong> e todos os seus itens serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluir} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Card de lista ───────────────────────────────────────────────────────────

interface CardListaProps {
  lista: TLista;
  renomeandoId: string | null;
  renomeandoValor: string;
  onAbrir: () => void;
  onIniciarRenomear: () => void;
  onRenomearChange: (v: string) => void;
  onConfirmarRenomear: () => void;
  onCancelarRenomear: () => void;
  onExcluir: () => void;
}

function CardLista({
  lista, renomeandoId, renomeandoValor,
  onAbrir, onIniciarRenomear, onRenomearChange,
  onConfirmarRenomear, onCancelarRenomear, onExcluir,
}: CardListaProps) {
  const isRenomeando = renomeandoId === lista.id;
  const dataFormatada = new Date(lista.updated_at).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short",
  });

  return (
    <div
      className="group relative rounded-xl border-2 border-border hover:border-primary/40 transition-all shadow-sm overflow-hidden cursor-pointer bg-card"
      onClick={!isRenomeando ? onAbrir : undefined}
    >
      {/* Espiral */}
      <div className="flex items-center gap-0 px-2 py-1 bg-muted/40 border-b border-border">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex-1 flex justify-center">
            <div className="h-2.5 w-2.5 rounded-full border-2 border-muted-foreground/20 bg-background" />
          </div>
        ))}
      </div>

      {/* Corpo */}
      <div className="flex">
        {/* Margem */}
        <div className="w-5 shrink-0 border-r-2 border-red-400/50" />

        <div className="flex-1 p-3 space-y-1">
          {isRenomeando ? (
            <div
              className="flex items-center gap-1"
              onClick={e => e.stopPropagation()}
            >
              <Input
                autoFocus
                value={renomeandoValor}
                onChange={e => onRenomearChange(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") onConfirmarRenomear();
                  if (e.key === "Escape") onCancelarRenomear();
                }}
                className="h-7 text-sm flex-1"
              />
              <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600 shrink-0" onClick={onConfirmarRenomear}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground shrink-0" onClick={onCancelarRenomear}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <p className="font-semibold text-sm leading-snug line-clamp-2">{lista.nome}</p>
          )}
          <p className="text-[11px] text-muted-foreground">Atualizado {dataFormatada}</p>
        </div>
      </div>

      {/* Menu */}
      <div
        className="absolute top-7 right-2"
        onClick={e => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onAbrir}>
              <ShoppingCart className="h-3.5 w-3.5 mr-2" /> Abrir lista
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onIniciarRenomear}>
              <Pencil className="h-3.5 w-3.5 mr-2" /> Renomear
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onExcluir}>
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ─── Tela de edição de uma lista ─────────────────────────────────────────────

function TelaLista({ lista, onVoltar }: { lista: TLista; onVoltar: () => void }) {
  const { itens, loading, carregar, adicionar, toggle, editar, excluir, limparConcluidos } =
    useItensLista(lista.id);

  const [novoNome, setNovoNome] = useState("");
  const [novaQtd, setNovaQtd] = useState("");
  const [adicionando, setAdicionando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editQtd, setEditQtd] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { carregar(); }, [carregar]);

  const handleAdicionar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNome.trim()) return;
    setAdicionando(true);
    const ok = await adicionar(novoNome, novaQtd);
    setAdicionando(false);
    if (ok) { setNovoNome(""); setNovaQtd(""); inputRef.current?.focus(); }
  };

  const iniciarEdicao = (item: ItemLista) => {
    setEditandoId(item.id);
    setEditNome(item.nome);
    setEditQtd(item.quantidade);
  };

  const confirmarEdicao = async () => {
    if (!editandoId || !editNome.trim()) return;
    await editar(editandoId, editNome, editQtd);
    setEditandoId(null);
  };

  const pendentes = itens.filter(i => !i.concluido);
  const concluidos = itens.filter(i => i.concluido);

  return (
    <div className="max-w-xl mx-auto space-y-4">
      {/* Topo */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onVoltar}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="font-semibold text-lg truncate max-w-[220px]">{lista.nome}</h2>
          {itens.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {pendentes.length}/{itens.length}
            </span>
          )}
        </div>
        {concluidos.length > 0 && (
          <Button
            variant="ghost" size="sm"
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

        {/* Espiral */}
        <div className="bg-muted/40 border-b border-border flex items-center gap-0 px-3 py-1.5">
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="flex-1 flex justify-center">
              <div className="h-3 w-3 rounded-full border-2 border-muted-foreground/25 bg-background" />
            </div>
          ))}
        </div>

        {/* Conteúdo com margem lateral */}
        <div className="bg-[#fafaf7] dark:bg-[#1c1c18] flex">
          <div className="w-8 shrink-0 border-r-2 border-red-400/60" />

          <div className="flex-1">
            {/* Input novo item */}
            <form
              onSubmit={handleAdicionar}
              className="flex items-center gap-2 px-3 py-2.5 border-b border-blue-200/70 dark:border-blue-900/40"
            >
              <Input
                ref={inputRef}
                placeholder="Adicionar item..."
                value={novoNome}
                onChange={e => setNovoNome(e.target.value)}
                className="flex-1 h-8 text-base border-0 rounded-none bg-transparent px-0 shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/40"
              />
              <Input
                placeholder="Qtd"
                value={novaQtd}
                onChange={e => setNovaQtd(e.target.value)}
                className="w-14 h-8 text-base border-0 rounded-none bg-transparent px-0 shadow-none focus-visible:ring-0 text-center placeholder:text-muted-foreground/40"
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
                    onToggle={() => toggle(item.id, item.concluido)}
                    onIniciarEdicao={() => iniciarEdicao(item)}
                    onExcluir={() => excluir(item.id)}
                    onEditNomeChange={setEditNome}
                    onEditQtdChange={setEditQtd}
                    onConfirmarEdicao={confirmarEdicao}
                    onCancelarEdicao={() => setEditandoId(null)}
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
                        onToggle={() => toggle(item.id, item.concluido)}
                        onIniciarEdicao={() => iniciarEdicao(item)}
                        onExcluir={() => excluir(item.id)}
                        onEditNomeChange={setEditNome}
                        onEditQtdChange={setEditQtd}
                        onConfirmarEdicao={confirmarEdicao}
                        onCancelarEdicao={() => setEditandoId(null)}
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

// ─── Linha de item ────────────────────────────────────────────────────────────

interface ItemRowProps {
  item: ItemLista;
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
  item, editandoId, editNome, editQtd,
  onToggle, onIniciarEdicao, onExcluir,
  onEditNomeChange, onEditQtdChange, onConfirmarEdicao, onCancelarEdicao,
}: ItemRowProps) {
  if (editandoId === item.id) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 border-b border-blue-200/60 dark:border-blue-900/40">
        <Input
          autoFocus
          value={editNome}
          onChange={e => onEditNomeChange(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") onConfirmarEdicao(); if (e.key === "Escape") onCancelarEdicao(); }}
          className="flex-1 h-7 text-base border-0 border-b border-primary rounded-none bg-transparent px-0 shadow-none focus-visible:ring-0"
        />
        <Input
          value={editQtd}
          onChange={e => onEditQtdChange(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") onConfirmarEdicao(); if (e.key === "Escape") onCancelarEdicao(); }}
          className="w-14 h-7 text-base border-0 border-b border-primary rounded-none bg-transparent px-0 shadow-none focus-visible:ring-0 text-center"
        />
        <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600" onClick={onConfirmarEdicao}>
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
        item.concluido && "opacity-50"
      )}
    >
      <button
        onClick={onToggle}
        className={cn(
          "h-4 w-4 rounded-sm border-2 shrink-0 flex items-center justify-center transition-colors",
          item.concluido ? "bg-primary border-primary" : "border-muted-foreground/35 hover:border-primary"
        )}
      >
        {item.concluido && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
      </button>

      <span className={cn("flex-1 text-base", item.concluido && "line-through text-muted-foreground")}>
        {item.nome}
      </span>

      {item.quantidade && item.quantidade !== "1" && (
        <span className="text-sm text-muted-foreground/60 shrink-0 tabular-nums">{item.quantidade}</span>
      )}

      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={onIniciarEdicao}>
          <Pencil className="h-3 w-3" />
        </Button>
        <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={onExcluir}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
