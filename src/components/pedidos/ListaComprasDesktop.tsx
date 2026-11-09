// Aba Lista de Compras no computador (>= 1024px). Mesma lógica e mesmos hooks da
// ListaCompras de sempre (useListasCompras / useItensLista): criar, renomear e excluir
// listas; abrir; itens pendentes e "Comprados"; marcar, editar, excluir e "Limpar
// comprados". Muda só o visual (cartões caderno em grade e lista aberta com resumo ao
// lado). Abaixo de 1024px a página usa a ListaCompras de sempre.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft, Check, Eraser, MoreVertical, Pencil, Plus, ShoppingBag, ShoppingCart, Trash2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useListasCompras, useItensLista, type ListaCompras as TLista, type ItemLista } from "@/hooks/useListaCompras";
import { useFormatadores } from "@/hooks/useFormatadores";
import { localeIntl } from "@/lib/i18n/formatadores";
import { resumoItensLista } from "@/lib/pedidos/listaComprasDesktop";
import { cn } from "@/lib/utils";

const PREFIXO = "telaDesktop.listaCompras";

/** Furos da espiral do caderno (decoração). */
function Espiral({ furos, grande = false }: { furos: number; grande?: boolean }) {
  return (
    <div className={cn("flex items-center border-b border-border bg-muted/40", grande ? "px-3 py-1.5" : "px-2 py-1")} aria-hidden="true">
      {Array.from({ length: furos }).map((_, i) => (
        <div key={i} className="flex flex-1 justify-center">
          <div className={cn("rounded-full border-2 border-muted-foreground/25 bg-background", grande ? "h-3 w-3" : "h-2.5 w-2.5")} />
        </div>
      ))}
    </div>
  );
}

// ─── Grade de listas ─────────────────────────────────────────────────────────

export function ListaComprasDesktop() {
  const { t } = useTranslation("pedidos", { keyPrefix: PREFIXO });
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
    return <TelaListaDesktop lista={listaAberta} onVoltar={() => { setListaAberta(null); carregar(); }} />;
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <ShoppingCart className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold leading-6">{t("titulo")}</h2>
              {loading ? (
                <Skeleton className="mt-1 h-4 w-16" />
              ) : (
                <p className="text-sm text-muted-foreground">{t("quantidade", { count: listas.length })}</p>
              )}
            </div>
          </div>
          <Button onClick={() => setMostrarForm((v) => !v)} className="h-11 shrink-0 gap-2 rounded-xl px-5">
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("novaLista")}
          </Button>
        </div>

        {mostrarForm && (
          <form onSubmit={handleCriar} className="mt-4 flex gap-2 border-t pt-4">
            <Input
              autoFocus
              placeholder={t("nomePlaceholder")}
              aria-label={t("nomeRotulo")}
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              className="h-11 flex-1"
            />
            <Button type="submit" disabled={criando || !novoNome.trim()} className="h-11 px-5">
              {criando ? t("criando") : t("criar")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-11 w-11 p-0"
              onClick={() => { setMostrarForm(false); setNovoNome(""); }}
              aria-label={t("cancelar")}
              title={t("cancelar")}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </form>
        )}
      </Card>

      {loading ? (
        <div className="grid grid-cols-3 gap-4 2xl:grid-cols-4" aria-hidden="true">
          {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-[104px] rounded-xl" />)}
        </div>
      ) : listas.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 rounded-2xl px-6 py-14 text-center shadow-sm">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <ShoppingBag className="h-7 w-7" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <p className="text-lg font-semibold">{t("vazioTitulo")}</p>
            <p className="text-sm text-muted-foreground">{t("vazioTexto")}</p>
          </div>
          {!mostrarForm && (
            <Button onClick={() => setMostrarForm(true)} className="mt-1 h-11 gap-2 rounded-xl px-5">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("novaLista")}
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-3 gap-4 2xl:grid-cols-4">
          {listas.map((lista) => (
            <CardListaDesktop
              key={lista.id}
              lista={lista}
              renomeando={renomeandoId === lista.id}
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

      <AlertDialog open={!!excluindoLista} onOpenChange={(o) => { if (!o) setExcluindoLista(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("excluirTitulo")}</AlertDialogTitle>
            <AlertDialogDescription>{t("excluirTexto", { nome: excluindoLista?.nome ?? "" })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancelar")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluir} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("excluirConfirmar")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Cartão de lista ─────────────────────────────────────────────────────────

interface CardListaDesktopProps {
  lista: TLista;
  renomeando: boolean;
  renomeandoValor: string;
  onAbrir: () => void;
  onIniciarRenomear: () => void;
  onRenomearChange: (v: string) => void;
  onConfirmarRenomear: () => void;
  onCancelarRenomear: () => void;
  onExcluir: () => void;
}

function CardListaDesktop(p: CardListaDesktopProps) {
  const { t } = useTranslation("pedidos", { keyPrefix: PREFIXO });
  const { ctx } = useFormatadores();
  // Como a lista de sempre ("04 de nov."), no idioma da conta.
  const data = new Date(p.lista.updated_at).toLocaleDateString(localeIntl(ctx), { day: "2-digit", month: "short" });

  return (
    <div
      role={p.renomeando ? undefined : "button"}
      tabIndex={p.renomeando ? undefined : 0}
      aria-label={p.renomeando ? undefined : `${t("abrir")}: ${p.lista.nome}`}
      onClick={p.renomeando ? undefined : p.onAbrir}
      onKeyDown={p.renomeando ? undefined : (e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); p.onAbrir(); }
      }}
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card shadow-sm transition-all",
        !p.renomeando && "cursor-pointer hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
    >
      <Espiral furos={12} />
      <div className="flex">
        <div className="w-5 shrink-0 border-r-2 border-red-400/50" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-1 py-3 pl-3 pr-11">
          {p.renomeando ? (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <Input
                autoFocus
                aria-label={t("novoNomeRotulo")}
                value={p.renomeandoValor}
                onChange={(e) => p.onRenomearChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") p.onConfirmarRenomear();
                  if (e.key === "Escape") p.onCancelarRenomear();
                }}
                className="h-8 flex-1 text-sm"
              />
              <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-green-600" onClick={p.onConfirmarRenomear} aria-label={t("salvarNome")} title={t("salvarNome")}>
                <Check className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-muted-foreground" onClick={p.onCancelarRenomear} aria-label={t("cancelarNome")} title={t("cancelarNome")}>
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          ) : (
            <p className="line-clamp-2 font-semibold leading-snug [overflow-wrap:anywhere]" title={p.lista.nome}>{p.lista.nome}</p>
          )}
          <p className="text-xs text-muted-foreground">{t("atualizado", { data })}</p>
        </div>
      </div>

      {!p.renomeando && (
        <div className="absolute right-2 top-8" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 opacity-60 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                aria-label={t("menu")}
                title={t("menu")}
              >
                <MoreVertical className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={p.onAbrir}>
                <ShoppingCart className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> {t("abrir")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={p.onIniciarRenomear}>
                <Pencil className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> {t("renomear")}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={p.onExcluir}>
                <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> {t("excluir")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

// ─── Lista aberta ────────────────────────────────────────────────────────────

function TelaListaDesktop({ lista, onVoltar }: { lista: TLista; onVoltar: () => void }) {
  const { t } = useTranslation("pedidos", { keyPrefix: PREFIXO });
  const { itens, loading, carregar, adicionar, toggle, editar, excluir, limparConcluidos } = useItensLista(lista.id);
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

  const pendentes = itens.filter((i) => !i.concluido);
  const concluidos = itens.filter((i) => i.concluido);
  const resumo = resumoItensLista(itens);

  const linha = (item: ItemLista) => (
    <ItemRowDesktop
      key={item.id}
      item={item}
      editando={editandoId === item.id}
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
  );

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={onVoltar} aria-label={t("voltar")} title={t("voltar")}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold leading-6" title={lista.nome}>{lista.nome}</h2>
              {itens.length > 0 && (
                <p className="text-sm text-muted-foreground tabular-nums">{resumo.pendentes}/{resumo.total}</p>
              )}
            </div>
          </div>
          {concluidos.length > 0 && (
            <Button variant="outline" className="h-10 shrink-0 gap-2 text-muted-foreground hover:text-destructive" onClick={limparConcluidos}>
              <Eraser className="h-4 w-4" aria-hidden="true" />
              {t("limparComprados")}
            </Button>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)_280px] items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Caderno */}
        <div className="overflow-hidden rounded-xl border border-border shadow-md">
          <Espiral furos={24} grande />
          <div className="flex bg-[#fafaf7] dark:bg-[#1c1c18]">
            <div className="w-8 shrink-0 border-r-2 border-red-400/60" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <form onSubmit={handleAdicionar} className="flex items-center gap-2 border-b border-blue-200/70 px-4 py-3 dark:border-blue-900/40">
                <Input
                  ref={inputRef}
                  placeholder={t("adicionarPlaceholder")}
                  aria-label={t("adicionarRotulo")}
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  className="h-9 flex-1 rounded-none border-0 bg-transparent px-0 text-base shadow-none placeholder:text-muted-foreground/50 focus-visible:ring-0"
                />
                <Input
                  placeholder={t("qtdPlaceholder")}
                  aria-label={t("qtdRotulo")}
                  value={novaQtd}
                  onChange={(e) => setNovaQtd(e.target.value)}
                  className="h-9 w-20 rounded-none border-0 bg-transparent px-0 text-center text-base shadow-none placeholder:text-muted-foreground/50 focus-visible:ring-0"
                />
                <Button
                  type="submit"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-full"
                  disabled={adicionando || !novoNome.trim()}
                  aria-label={t("adicionar")}
                  title={t("adicionar")}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </Button>
              </form>

              {loading ? (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">{t("carregando")}</div>
              ) : itens.length === 0 ? (
                <div className="px-4 py-14 text-center">
                  <ShoppingCart className="mx-auto mb-2 h-9 w-9 text-muted-foreground/25" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground/70">{t("listaVazia")}</p>
                </div>
              ) : (
                <>
                  {pendentes.map(linha)}
                  {concluidos.length > 0 && (
                    <>
                      <div className="border-y border-blue-200/60 bg-muted/30 px-4 py-1.5 dark:border-blue-900/40">
                        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                          {t("comprados", { count: concluidos.length })}
                        </span>
                      </div>
                      {concluidos.map(linha)}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Resumo (calculado dos itens já carregados) */}
        <Card className="space-y-4 rounded-2xl p-5 shadow-sm">
          <p className="font-semibold">{t("resumo.titulo")}</p>
          <dl className="space-y-2">
            {([
              ["pendentes", resumo.pendentes, "text-amber-600 dark:text-amber-400"],
              ["comprados", resumo.comprados, "text-emerald-600 dark:text-emerald-400"],
              ["total", resumo.total, ""],
            ] as const).map(([chave, valor, cor]) => (
              <div key={chave} className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2.5">
                <dt className="text-sm text-muted-foreground">{t(`resumo.${chave}`)}</dt>
                <dd className={cn("text-xl font-bold tabular-nums", cor)}>{loading ? "–" : valor}</dd>
              </div>
            ))}
          </dl>
          <div className="space-y-1.5">
            <Progress value={resumo.percentualComprado} aria-label={t("resumo.progresso", { percentual: resumo.percentualComprado })} />
            <p className="text-xs text-muted-foreground tabular-nums">{t("resumo.progresso", { percentual: resumo.percentualComprado })}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Linha de item ───────────────────────────────────────────────────────────

interface ItemRowDesktopProps {
  item: ItemLista;
  editando: boolean;
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

function ItemRowDesktop(p: ItemRowDesktopProps) {
  const { t } = useTranslation("pedidos", { keyPrefix: PREFIXO });
  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") p.onConfirmarEdicao();
    if (e.key === "Escape") p.onCancelarEdicao();
  };

  if (p.editando) {
    return (
      <div className="flex items-center gap-2 border-b border-blue-200/60 px-4 py-2 dark:border-blue-900/40">
        <Input
          autoFocus
          aria-label={t("adicionarRotulo")}
          value={p.editNome}
          onChange={(e) => p.onEditNomeChange(e.target.value)}
          onKeyDown={teclas}
          className="h-8 flex-1 rounded-none border-0 border-b border-primary bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
        />
        <Input
          aria-label={t("qtdRotulo")}
          value={p.editQtd}
          onChange={(e) => p.onEditQtdChange(e.target.value)}
          onKeyDown={teclas}
          className="h-8 w-20 rounded-none border-0 border-b border-primary bg-transparent px-0 text-center text-base shadow-none focus-visible:ring-0"
        />
        <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={p.onConfirmarEdicao} aria-label={t("salvarItem")} title={t("salvarItem")}>
          <Check className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={p.onCancelarEdicao} aria-label={t("cancelarEdicao")} title={t("cancelarEdicao")}>
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex items-center gap-3 border-b border-blue-200/60 px-4 py-2.5 transition-colors hover:bg-blue-50/40 dark:border-blue-900/40 dark:hover:bg-blue-950/20",
        p.item.concluido && "opacity-55",
      )}
    >
      <button
        type="button"
        onClick={p.onToggle}
        role="checkbox"
        aria-checked={p.item.concluido}
        aria-label={`${p.item.concluido ? t("desmarcar") : t("marcar")}: ${p.item.nome}`}
        title={p.item.concluido ? t("desmarcar") : t("marcar")}
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          p.item.concluido ? "border-primary bg-primary" : "border-muted-foreground/40 hover:border-primary",
        )}
      >
        {p.item.concluido && <Check className="h-3 w-3 text-primary-foreground" aria-hidden="true" />}
      </button>

      <span className={cn("min-w-0 flex-1 text-base [overflow-wrap:anywhere]", p.item.concluido && "text-muted-foreground line-through")}>
        {p.item.nome}
      </span>

      {p.item.quantidade && (
        <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-sm tabular-nums text-muted-foreground">{p.item.quantidade}</span>
      )}

      <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={p.onIniciarEdicao} aria-label={t("editarItem")} title={t("editarItem")}>
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={p.onExcluir} aria-label={t("excluirItem")} title={t("excluirItem")}>
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
