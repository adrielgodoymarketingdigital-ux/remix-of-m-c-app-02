// Tabela da tela Orçamentos no computador (>= 1024px), com paginação no rodapé.
// Só visual: recebe a página já calculada (paginar) e os MESMOS handlers da página.
// O selo clicável e o menu de ações repetem a TabelaOrcamentos de sempre (mesmos itens,
// mesmas condições pelo status gravado, mesmas chamadas); só os textos são traduzidos.
// Abaixo de 1024px a página usa a TabelaOrcamentos de sempre.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Edit,
  Eye,
  FileText,
  MoreHorizontal,
  Plus,
  Printer,
  RefreshCw,
  SearchX,
  ShoppingCart,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { buscarConfiguracaoLojaPorEmpresa } from "@/hooks/useConfiguracaoLoja";
import { gerarOrcamentoPDF } from "@/lib/gerarOrcamentoPDF";
import {
  dataCurta,
  diaBrasilia,
  estaExpirado,
  iniciaisCliente,
  OPCOES_POR_PAGINA,
  paginasVisiveis,
  textoCriacao,
  textoValidade,
  type PaginaLista,
} from "@/lib/orcamentos/listaOrcamentosDesktop";
import { cn } from "@/lib/utils";
import type { Orcamento, StatusOrcamento } from "@/types/orcamento";

interface TabelaOrcamentosDesktopProps {
  /** Página já calculada sobre a lista filtrada (paginar). */
  pagina: PaginaLista<Orcamento>;
  porPagina: number;
  onPagina: (pagina: number) => void;
  onPorPagina: (porPagina: number) => void;
  carregando: boolean;
  /** Orçamentos carregados ao todo: 0 = nenhum cadastrado; senão a lista vazia é culpa do filtro. */
  totalGeral: number;
  onNovoOrcamento: () => void;
  onLimparFiltros: () => void;
  onVisualizar: (orcamento: Orcamento) => void;
  onEditar: (orcamento: Orcamento) => void;
  onExcluir: (orcamento: Orcamento) => void;
  onAtualizarStatus: (id: string, status: StatusOrcamento) => void;
  onConverterOS: (orcamento: Orcamento) => void;
}

// Mesmas cores e mesma ordem da TabelaOrcamentos (que segue a lógica visual da OS).
const COR_STATUS: Record<StatusOrcamento, string> = {
  pendente: "#eab308",
  aprovado: "#22c55e",
  rejeitado: "#ef4444",
  expirado: "#6b7280",
  convertido: "#a855f7",
};
const ORDEM_STATUS: StatusOrcamento[] = ["pendente", "aprovado", "rejeitado", "expirado", "convertido"];

const VAZIO = "-";

/** Igual ao BadgeStatusCliclavel da TabelaOrcamentos: mostra o status efetivo e grava o escolhido. */
function SeloStatus({
  orcamento,
  expirado,
  onAtualizarStatus,
}: {
  orcamento: Orcamento;
  expirado: boolean;
  onAtualizarStatus: (id: string, status: StatusOrcamento) => void;
}) {
  const { t } = useTranslation("comum", { keyPrefix: "orcamentos" });
  const [aberto, setAberto] = useState(false);
  const statusReal: StatusOrcamento = expirado ? "expirado" : orcamento.status;
  const cor = COR_STATUS[statusReal];

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("tabela.alterarStatus", { numero: orcamento.numero_orcamento })}
          className="inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all hover:opacity-80"
          style={{ color: cor, borderColor: `${cor}40`, backgroundColor: `${cor}14` }}
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: cor }} />
          <span className="truncate">{t(`status.${statusReal}`)}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-0" align="start">
        <Command>
          <CommandGroup>
            {ORDEM_STATUS.map((status) => (
              <CommandItem
                key={status}
                value={status}
                onSelect={(value) => {
                  onAtualizarStatus(orcamento.id, value as StatusOrcamento);
                  setAberto(false);
                }}
                className="flex cursor-pointer items-center gap-2"
              >
                <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COR_STATUS[status] }} />
                <span className="flex-1 text-xs">{t(`status.${status}`)}</span>
                {statusReal === status && <Check className="h-3.5 w-3.5 shrink-0" />}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function TabelaOrcamentosDesktop(p: TabelaOrcamentosDesktopProps) {
  const { t } = useTranslation("comum", { keyPrefix: "orcamentos.tabela" });
  const { t: tTopo } = useTranslation("comum", { keyPrefix: "orcamentos" });
  const { pagina } = p;

  // A mesma impressão da TabelaOrcamentos (PDF com a configuração da loja da empresa do orçamento).
  const handleImprimir = async (orcamento: Orcamento) => {
    const lojaConfig = await buscarConfiguracaoLojaPorEmpresa(orcamento.empresa_id);
    await gerarOrcamentoPDF(orcamento, lojaConfig);
  };

  if (p.carregando) {
    return (
      <Card className="space-y-4 rounded-2xl p-5 shadow-sm" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        ))}
      </Card>
    );
  }

  if (pagina.total === 0) {
    const nenhumCadastrado = p.totalGeral === 0;
    const Icone = nenhumCadastrado ? FileText : SearchX;
    return (
      <Card className="flex flex-col items-center justify-center gap-3 rounded-2xl px-6 py-14 text-center shadow-sm">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <Icone className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">{nenhumCadastrado ? t("vazioTitulo") : t("semResultadoTitulo")}</p>
          <p className="text-sm text-muted-foreground">{nenhumCadastrado ? t("vazioTexto") : t("semResultadoTexto")}</p>
        </div>
        {nenhumCadastrado ? (
          <Button onClick={p.onNovoOrcamento} className="mt-1 gap-2">
            <Plus className="h-4 w-4" aria-hidden="true" />
            {tTopo("novoOrcamento")}
          </Button>
        ) : (
          <Button variant="outline" onClick={p.onLimparFiltros} className="mt-1 gap-2">
            <X className="h-4 w-4" aria-hidden="true" />
            {tTopo("filtros.limparFiltros")}
          </Button>
        )}
      </Card>
    );
  }

  const agora = new Date();

  return (
    <Card className="overflow-hidden rounded-2xl shadow-sm">
      {/* table-fixed + larguras: só o Cliente estica. As colunas fixas somam 800px (Ações com
          84px para caber "Acciones" do es); em 1280px com o menu aberto (~974px de caixa)
          sobram ~174px para o Cliente (o telefone cabe inteiro), que corta com
          reticências e mostra o nome inteiro na dica. Abaixo de 920px de caixa (ex.: 1024px)
          a tabela rola dentro do cartão. */}
      <Table className="min-w-[920px] table-fixed">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[156px] pl-4 pr-2">{t("colunas.numero")}</TableHead>
            <TableHead className="px-3">{t("colunas.cliente")}</TableHead>
            <TableHead className="w-[72px] px-2">{t("colunas.itens")}</TableHead>
            <TableHead className="w-[120px] px-2">{t("colunas.valorTotal")}</TableHead>
            <TableHead className="w-[140px] px-2">{t("colunas.validade")}</TableHead>
            <TableHead className="w-[120px] px-2">{t("colunas.status")}</TableHead>
            <TableHead className="w-[108px] px-2">{t("colunas.data")}</TableHead>
            <TableHead className="w-[84px] px-2 pr-4 text-center">{t("colunas.acoes")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagina.itens.map((orcamento) => {
            const expirado = estaExpirado(orcamento, agora);
            const diaValidade = diaBrasilia(orcamento.data_validade);
            const diaCriacao = diaBrasilia(orcamento.created_at);
            const tempoValidade = textoValidade(orcamento.data_validade, agora);
            const tempoCriacao = textoCriacao(orcamento.created_at, agora);
            const iniciais = iniciaisCliente(orcamento.cliente_nome);
            const qtdItens = orcamento.itens?.length || 0;
            return (
              <TableRow key={orcamento.id}>
                <TableCell className="truncate py-3 pl-4 pr-2 text-[13px] font-medium tabular-nums" title={orcamento.numero_orcamento}>
                  {orcamento.numero_orcamento}
                </TableCell>
                <TableCell className="px-3 py-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div
                      className={cn(
                        "grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold",
                        iniciais ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                      )}
                      aria-hidden="true"
                    >
                      {iniciais || VAZIO}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium" title={orcamento.cliente_nome || undefined}>
                        {orcamento.cliente_nome || VAZIO}
                      </p>
                      <p className="truncate text-xs text-muted-foreground tabular-nums" title={orcamento.cliente_telefone || undefined}>
                        {orcamento.cliente_telefone || VAZIO}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-2 py-3 tabular-nums">{t("itens", { count: qtdItens })}</TableCell>
                <TableCell className="px-2 py-3 font-semibold tabular-nums [overflow-wrap:anywhere]">
                  {/* Preço ao cliente: nunca some com o olho (como em Pedidos). */}
                  <ValorMonetario valor={orcamento.valor_total} tipo="preco" />
                </TableCell>
                <TableCell className="px-2 py-3">
                  {diaValidade ? (
                    <>
                      <p className={cn("tabular-nums", expirado && "font-medium text-destructive")}>{dataCurta(diaValidade)}</p>
                      {tempoValidade && (
                        <p className="truncate text-xs text-muted-foreground">
                          {tempoValidade.tipo === "hoje"
                            ? t("hoje")
                            : tempoValidade.tipo === "vencido"
                              ? t("vencidoHa", { count: tempoValidade.dias })
                              : t("venceEm", { count: tempoValidade.dias })}
                        </p>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">{VAZIO}</span>
                  )}
                </TableCell>
                <TableCell className="px-2 py-3">
                  <SeloStatus orcamento={orcamento} expirado={expirado} onAtualizarStatus={p.onAtualizarStatus} />
                </TableCell>
                <TableCell className="px-2 py-3">
                  {diaCriacao ? (
                    <>
                      <p className="tabular-nums">{dataCurta(diaCriacao)}</p>
                      {tempoCriacao && (
                        <p className="truncate text-xs text-muted-foreground">
                          {tempoCriacao.tipo === "hoje" ? t("hoje") : t("criadoHa", { count: tempoCriacao.dias })}
                        </p>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">{VAZIO}</span>
                  )}
                </TableCell>
                <TableCell className="px-2 py-3 pr-4 text-center">
                  {/* Os mesmos itens e condições da TabelaOrcamentos (status gravado, não o efetivo). */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-lg"
                        aria-label={t("acoesRotulo", { numero: orcamento.numero_orcamento })}
                      >
                        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => p.onVisualizar(orcamento)}>
                        <Eye className="mr-2 h-4 w-4" /> {t("acoes.visualizar")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleImprimir(orcamento)}>
                        <Printer className="mr-2 h-4 w-4" /> {t("acoes.imprimir")}
                      </DropdownMenuItem>
                      {orcamento.status === "pendente" && (
                        <>
                          <DropdownMenuItem onClick={() => p.onEditar(orcamento)}>
                            <Edit className="mr-2 h-4 w-4" /> {t("acoes.editar")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => p.onAtualizarStatus(orcamento.id, "aprovado")}>
                            <CheckCircle className="mr-2 h-4 w-4 text-green-600" /> {t("acoes.aprovar")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => p.onAtualizarStatus(orcamento.id, "rejeitado")}>
                            <XCircle className="mr-2 h-4 w-4 text-destructive" /> {t("acoes.rejeitar")}
                          </DropdownMenuItem>
                        </>
                      )}
                      {(orcamento.status === "pendente" || orcamento.status === "aprovado") && (
                        <DropdownMenuItem onClick={() => p.onConverterOS(orcamento)} className="font-medium text-primary">
                          <ArrowRight className="mr-2 h-4 w-4" /> {t("acoes.converterOS")}
                        </DropdownMenuItem>
                      )}
                      {orcamento.status === "aprovado" && (
                        <DropdownMenuItem onClick={() => p.onAtualizarStatus(orcamento.id, "convertido")}>
                          <ShoppingCart className="mr-2 h-4 w-4" /> {t("acoes.converterVenda")}
                        </DropdownMenuItem>
                      )}
                      {(orcamento.status === "rejeitado" || orcamento.status === "expirado") && (
                        <DropdownMenuItem onClick={() => p.onAtualizarStatus(orcamento.id, "pendente")}>
                          <RefreshCw className="mr-2 h-4 w-4" /> {t("acoes.reabrir")}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => p.onExcluir(orcamento)} className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" /> {t("acoes.excluir")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3">
        <p className="text-sm text-muted-foreground tabular-nums">
          {t("exibindo", { inicio: pagina.inicio, fim: pagina.fim, count: pagina.total })}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {pagina.totalPaginas > 1 && (
            <nav className="flex items-center gap-1" aria-label={t("paginacao")}>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => p.onPagina(pagina.pagina - 1)}
                disabled={pagina.pagina === 1}
                aria-label={t("anterior")}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
              {paginasVisiveis(pagina.pagina, pagina.totalPaginas).map((n, i) =>
                n === "…" ? (
                  <span key={`buraco-${i}`} className="px-1 text-sm text-muted-foreground" aria-hidden="true">
                    …
                  </span>
                ) : (
                  <Button
                    key={n}
                    variant={n === pagina.pagina ? "default" : "outline"}
                    size="icon"
                    className="h-9 w-9 tabular-nums"
                    onClick={() => p.onPagina(n)}
                    aria-label={t("pagina", { numero: n })}
                    aria-current={n === pagina.pagina ? "page" : undefined}
                  >
                    {n}
                  </Button>
                ),
              )}
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => p.onPagina(pagina.pagina + 1)}
                disabled={pagina.pagina === pagina.totalPaginas}
                aria-label={t("proxima")}
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </nav>
          )}
          <Select value={String(p.porPagina)} onValueChange={(v) => p.onPorPagina(Number(v))}>
            <SelectTrigger className="h-9 w-[150px]" aria-label={t("porPaginaRotulo")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPCOES_POR_PAGINA.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {t("porPagina", { quantidade: n })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </Card>
  );
}
