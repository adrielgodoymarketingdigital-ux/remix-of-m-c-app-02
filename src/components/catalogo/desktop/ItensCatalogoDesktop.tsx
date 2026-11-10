// Passo "Itens" do Catálogo no computador (>= 1024px): modo de edição, categorias com ícone e
// cor, banner com busca, Filtros, grade/lista, cartões e paginação. Filtrar, ordenar, contar e
// paginar ficam em src/lib/catalogo/listaItensDesktop.ts (estado só aqui, sem URL).
// Marcar/desmarcar mexe em itensSelecionadosIds (rascunho: grava com o Salvar do topo);
// o olho grava exibir_no_catalogo na hora (função da página, a mesma de antes).
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ChevronLeft, ChevronRight, Info, LayoutGrid, List, PackageOpen, Pencil, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DialogEditarDispositivoCatalogo } from "@/components/catalogo/DialogEditarDispositivoCatalogo";
import {
  contarPorCategoria,
  desmarcarTodos,
  filtrarItens,
  gruposDeCategoria,
  ID_SEM_CATEGORIA,
  marcadosNoFiltro,
  marcarTodos,
  alternarItem,
  OPCOES_POR_PAGINA,
  ORDEM_PADRAO,
  ordenarItens,
  paginar,
  POR_PAGINA_PADRAO,
  resumoSelecao,
  tiposDisponiveis,
  type CondicaoItem,
  type FiltroSituacao,
  type MapaCustos,
  type OrdemItens,
} from "@/lib/catalogo/listaItensDesktop";
import type { CategoriaCatalogo } from "@/types/catalogo";
import type { ItemCatalogo } from "@/types/catalogo-item";
import { cn } from "@/lib/utils";
import { CartaoItemCatalogoDesktop, type ModoVisualizacao } from "./CartaoItemCatalogoDesktop";
import { CategoriasCatalogoDesktop, TODAS_AS_CATEGORIAS } from "./CategoriasCatalogoDesktop";

type DadosItem = { fotos: string[]; preco: number | null; precoPromocional: number | null };

interface ItensCatalogoDesktopProps {
  itens: ItemCatalogo[];
  /** Itens que o diálogo de categoria oferece para vincular (regra da tela antiga). */
  itensParaVincular: ItemCatalogo[];
  selecionados: string[];
  onSelecaoChange: (ids: string[]) => void;
  categorias: CategoriaCatalogo[] | undefined;
  onCategoriasChange: (categorias: CategoriaCatalogo[]) => void;
  onToggleExibirNoCatalogo: (item: ItemCatalogo) => void;
  atualizandoVisibilidade: Set<string>;
  modoEdicao: boolean;
  setModoEdicao: (v: boolean) => void;
  onAtualizarItem: (id: string, tipoItem: string, dados: DadosItem) => Promise<void>;
  tituloCatalogo: string;
  mapaCustos: MapaCustos;
  mostrarCusto: boolean;
  mostrarLucro: boolean;
  /** A seleção salva foi descartada pela regra de sempre (metade ou mais dos marcados sumiu). */
  selecaoDescartada: { salvos: number; sumiram: number } | null;
}

const TODOS = "todos";
const SITUACOES: FiltroSituacao[] = ["todos", "no_catalogo", "fora", "ocultos"];
const ORDENS: OrdemItens[] = ["nome_asc", "preco_asc", "preco_desc", "recente", "estoque_desc"];
const CONDICOES: CondicaoItem[] = ["novo", "semi_novo", "usado"];

export function ItensCatalogoDesktop(p: ItensCatalogoDesktopProps) {
  const { t } = useTranslation("catalogo", { keyPrefix: "telaDesktop" });
  const [busca, setBusca] = useState("");
  const [categoriaAtiva, setCategoriaAtiva] = useState(TODAS_AS_CATEGORIAS);
  const [tipo, setTipo] = useState(TODOS);
  const [condicao, setCondicao] = useState<CondicaoItem | typeof TODOS>(TODOS);
  const [situacao, setSituacao] = useState<FiltroSituacao>("todos");
  const [ordem, setOrdem] = useState<OrdemItens>(ORDEM_PADRAO);
  const [modo, setModo] = useState<ModoVisualizacao>("grade");
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState<number>(POR_PAGINA_PADRAO);
  const [editando, setEditando] = useState<ItemCatalogo | null>(null);

  const grupos = useMemo(() => gruposDeCategoria(p.itens, p.categorias), [p.itens, p.categorias]);
  const contagem = useMemo(() => contarPorCategoria(p.itens, grupos), [p.itens, grupos]);
  const tipos = useMemo(() => tiposDisponiveis(p.itens), [p.itens]);
  // Categoria apagada ou que saiu do agrupamento: volta para "Todos".
  const categoriaValida =
    categoriaAtiva === TODAS_AS_CATEGORIAS || categoriaAtiva === ID_SEM_CATEGORIA || grupos.some((g) => g.id === categoriaAtiva)
      ? categoriaAtiva
      : TODAS_AS_CATEGORIAS;

  const filtrados = useMemo(
    () =>
      ordenarItens(
        filtrarItens(p.itens, { busca, tipo, categoriaId: categoriaValida, condicao, situacao }, grupos, p.selecionados),
        ordem,
      ),
    [p.itens, busca, tipo, categoriaValida, condicao, situacao, grupos, p.selecionados, ordem],
  );
  const idsFiltrados = useMemo(() => filtrados.map((i) => i.id), [filtrados]);
  const paginaAtual = paginar(filtrados, pagina, porPagina);
  const resumo = resumoSelecao(p.itens, p.selecionados);
  const estadoFiltro = marcadosNoFiltro(p.selecionados, idsFiltrados);

  // Mudou busca/filtro/categoria/ordem/tamanho: volta para a página 1.
  useEffect(() => setPagina(1), [busca, tipo, categoriaValida, condicao, situacao, ordem, porPagina]);

  const filtrosAtivos = [tipo !== TODOS, condicao !== TODOS, situacao !== "todos", ordem !== ORDEM_PADRAO].filter(Boolean).length;
  const limparFiltros = () => {
    setBusca("");
    setTipo(TODOS);
    setCondicao(TODOS);
    setSituacao("todos");
    setOrdem(ORDEM_PADRAO);
    setCategoriaAtiva(TODAS_AS_CATEGORIAS);
  };

  const rotuloTipo = (chave: string) => {
    if (chave === "produto") return t("cartao.tipos.produto");
    if (chave === "peca") return t("cartao.tipos.peca");
    const tipoDispositivo = chave.slice("dispositivo:".length);
    return tipoDispositivo || t("cartao.tipos.dispositivo");
  };

  const nomeCategoriaAtiva =
    categoriaValida === TODAS_AS_CATEGORIAS
      ? t("categorias.todos")
      : categoriaValida === ID_SEM_CATEGORIA
        ? t("categorias.semCategoria")
        : grupos.find((g) => g.id === categoriaValida)?.nome ?? "";

  return (
    <div className="space-y-5">
      {/* Modo de edição */}
      <Card className="rounded-2xl px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
              <Pencil className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <Label htmlFor="modo-edicao-desktop" className="cursor-pointer text-sm font-semibold">
                {t("itens.modoEdicao")}
              </Label>
              <p className="text-xs text-muted-foreground">{t("itens.modoEdicaoDescricao")}</p>
            </div>
          </div>
          <Switch id="modo-edicao-desktop" checked={p.modoEdicao} onCheckedChange={p.setModoEdicao} />
        </div>
        {p.modoEdicao && (
          <div
            role="note"
            className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{t("itens.avisoEstoque")}</span>
          </div>
        )}
      </Card>

      <CategoriasCatalogoDesktop
        grupos={grupos}
        contagem={contagem}
        ativa={categoriaValida}
        onAtivar={setCategoriaAtiva}
        categoriasManuais={p.categorias ?? []}
        onCategoriasChange={p.onCategoriasChange}
        itensParaVincular={p.itensParaVincular}
      />

      {/* Banner com busca, Filtros e grade/lista (cores fixas da marca, iguais no claro e no escuro). */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#061d45] via-[#09265f] to-[#0b5be8] px-8 py-7 text-white shadow-lg">
        <div
          className="pointer-events-none absolute -right-24 -top-28 h-[360px] w-[480px] rounded-full border-[56px] border-white/[0.06]"
          aria-hidden="true"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-sky-300">{t("banner.sobretitulo")}</p>
            <h2 className="mt-2 truncate text-2xl font-bold tracking-tight">{p.tituloCatalogo}</h2>
            <p className="mt-1 text-sm text-white/80">
              {t("banner.noEstoque", { count: resumo.total })} · {t("banner.noPublico", { count: resumo.noPublico })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-11 w-[340px] max-w-full items-center gap-2 rounded-xl bg-white px-3 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder={t("banner.busca")}
                aria-label={t("banner.buscaRotulo")}
                className="h-9 border-0 bg-transparent p-0 text-sm text-slate-900 shadow-none placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0 dark:text-slate-100"
              />
              {busca && (
                <button type="button" onClick={() => setBusca("")} aria-label={t("banner.limparFiltros")} className="shrink-0">
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-11 rounded-xl border-0 bg-white px-4 text-slate-800 hover:bg-white/90 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
                  <SlidersHorizontal className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t("banner.filtros")}
                  {filtrosAtivos > 0 && (
                    <span className="ml-2 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
                      {filtrosAtivos}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 space-y-3">
                <CampoFiltro rotulo={t("filtros.tipo")}>
                  <Select value={tipo} onValueChange={setTipo}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TODOS}>{t("filtros.todosTipos")}</SelectItem>
                      {tipos.map((c) => (
                        <SelectItem key={c} value={c}>
                          {rotuloTipo(c)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CampoFiltro>
                <CampoFiltro rotulo={t("filtros.condicao")}>
                  <Select value={condicao} onValueChange={(v) => setCondicao(v as CondicaoItem | typeof TODOS)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TODOS}>{t("filtros.todasCondicoes")}</SelectItem>
                      {CONDICOES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {t(`filtros.condicoes.${c}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CampoFiltro>
                <CampoFiltro rotulo={t("filtros.situacao")}>
                  <Select value={situacao} onValueChange={(v) => setSituacao(v as FiltroSituacao)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SITUACOES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {t(`filtros.situacoes.${s}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CampoFiltro>
                <CampoFiltro rotulo={t("filtros.ordem")}>
                  <Select value={ordem} onValueChange={(v) => setOrdem(v as OrdemItens)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORDENS.map((o) => (
                        <SelectItem key={o} value={o}>
                          {t(`filtros.ordens.${o}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CampoFiltro>
                <Button variant="ghost" size="sm" onClick={limparFiltros} className="w-full">
                  <X className="mr-1 h-4 w-4" aria-hidden="true" />
                  {t("banner.limparFiltros")}
                </Button>
              </PopoverContent>
            </Popover>
            <div className="flex rounded-xl bg-white p-1 dark:bg-slate-900" role="radiogroup" aria-label={t("banner.visualizacao")}>
              {(["grade", "lista"] as const).map((m) => {
                const Icone = m === "grade" ? LayoutGrid : List;
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={modo === m}
                    aria-label={t(`banner.${m}`)}
                    title={t(`banner.${m}`)}
                    onClick={() => setModo(m)}
                    className={cn(
                      "grid h-9 w-9 place-items-center rounded-lg transition-colors",
                      modo === m ? "btn-primary-gradient text-white" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800",
                    )}
                  >
                    <Icone className="h-4 w-4" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Seleção: o que entra no catálogo */}
      {p.selecaoDescartada && resumo.todosEntram && (
        <div
          role="note"
          className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t("selecao.descartada", p.selecaoDescartada)}</span>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            {nomeCategoriaAtiva}
            <span className="text-sm font-medium text-primary">{t("lista.contagem", { count: filtrados.length })}</span>
          </h3>
          <p className="text-sm text-muted-foreground" role="status">
            {resumo.todosEntram ? t("selecao.nenhumMarcado") : t("selecao.marcados", { marcados: resumo.marcados, total: resumo.total })}
          </p>
        </div>
        {filtrados.length > 0 && (
          <div className="flex items-center gap-2">
            {estadoFiltro !== "todos" && (
              <Button variant="outline" size="sm" className="rounded-lg" onClick={() => p.onSelecaoChange(marcarTodos(p.selecionados, idsFiltrados))}>
                {t("selecao.marcarTodos", { count: idsFiltrados.length })}
              </Button>
            )}
            {estadoFiltro !== "nenhum" && (
              <Button variant="outline" size="sm" className="rounded-lg" onClick={() => p.onSelecaoChange(desmarcarTodos(p.selecionados, idsFiltrados))}>
                {t("selecao.desmarcarTodos", { count: idsFiltrados.length })}
              </Button>
            )}
          </div>
        )}
      </div>
      <p className="-mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {t("selecao.rascunho")}
      </p>

      {/* Lista */}
      {p.itens.length === 0 ? (
        <EstadoVazio titulo={t("lista.vazioEstoque")} descricao={t("lista.vazioEstoqueDescricao")} />
      ) : filtrados.length === 0 ? (
        <EstadoVazio titulo={t("lista.semResultado")} descricao={t("lista.semResultadoDescricao")}>
          <Button variant="outline" size="sm" onClick={limparFiltros} className="mt-3">
            {t("banner.limparFiltros")}
          </Button>
        </EstadoVazio>
      ) : (
        <div className={cn("grid gap-4", modo === "grade" ? "xl:grid-cols-2" : "grid-cols-1 gap-2")}>
          {paginaAtual.itens.map((item) => (
            <CartaoItemCatalogoDesktop
              key={item.id}
              item={item}
              modo={modo}
              grupos={grupos}
              marcado={p.selecionados.includes(item.id)}
              onAlternarMarcado={() => p.onSelecaoChange(alternarItem(p.selecionados, item.id))}
              onAlternarOculto={() => p.onToggleExibirNoCatalogo(item)}
              atualizandoOculto={p.atualizandoVisibilidade.has(item.id)}
              modoEdicao={p.modoEdicao}
              onEditar={() => setEditando(item)}
              custo={p.mapaCustos.get(item.id)}
              mostrarCusto={p.mostrarCusto}
              mostrarLucro={p.mostrarLucro}
            />
          ))}
        </div>
      )}

      {/* Paginação */}
      {filtrados.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm">
          <span className="text-muted-foreground">
            {t("paginacao.exibindo", { inicio: paginaAtual.inicio, fim: paginaAtual.fim, total: paginaAtual.total })}
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{t("paginacao.porPagina")}</span>
              <Select value={String(paginaAtual.porPagina)} onValueChange={(v) => setPorPagina(Number(v))}>
                <SelectTrigger className="h-9 w-[76px]" aria-label={t("paginacao.porPagina")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPCOES_POR_PAGINA.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className="text-muted-foreground">{t("paginacao.pagina", { pagina: paginaAtual.pagina, total: paginaAtual.totalPaginas })}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              disabled={paginaAtual.pagina <= 1}
              onClick={() => setPagina(paginaAtual.pagina - 1)}
              aria-label={t("paginacao.anterior")}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              disabled={paginaAtual.pagina >= paginaAtual.totalPaginas}
              onClick={() => setPagina(paginaAtual.pagina + 1)}
              aria-label={t("paginacao.proxima")}
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}

      {/* Diálogo de fotos e preço de sempre: grava direto no estoque (função da página). */}
      {editando && (
        <DialogEditarDispositivoCatalogo
          key={editando.id}
          open
          onOpenChange={(aberto) => !aberto && setEditando(null)}
          dispositivo={{
            id: editando.id,
            marca: editando.marca || editando.nome,
            modelo: editando.modelo || "",
            tipo: editando.tipo_dispositivo || editando.tipo_item,
            condicao: editando.condicao || "semi_novo",
            garantia: editando.garantia || false,
            vendido: editando.vendido || false,
            quantidade: editando.quantidade,
            created_at: editando.created_at,
            preco: editando.preco,
            preco_promocional: editando.preco_promocional,
            foto_url: editando.foto_url,
            fotos: editando.fotos,
          }}
          onSave={(dados) => p.onAtualizarItem(editando.id, editando.tipo_item, dados)}
        />
      )}
    </div>
  );
}

function CampoFiltro({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{rotulo}</Label>
      {children}
    </div>
  );
}

function EstadoVazio({ titulo, descricao, children }: { titulo: string; descricao: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed py-14 text-center">
      <PackageOpen className="h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
      <p className="mt-3 font-semibold">{titulo}</p>
      <p className="text-sm text-muted-foreground">{descricao}</p>
      {children}
    </div>
  );
}
