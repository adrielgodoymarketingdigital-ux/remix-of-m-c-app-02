// Tabela de compras só do computador (>= 1024px). Abaixo disso a página usa
// TabelaCompras (768–1023) e ListaComprasMobile (celular), intocadas.
// Mesmas ações e mesmos textos de confirmação da TabelaCompras; o que muda é o
// visual, a seleção (só para exportar), a ordenação e a paginação em memória.
import { useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Edit,
  Eye,
  FileText,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/formatters";
import { downloadPDFRobust } from "@/lib/downloadPDF";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { avatarFornecedor } from "@/components/fornecedores/avatarFornecedor";
import { CompraDispositivo } from "@/types/origem";
import { descreverAparelhoEncontrado, type AparelhoEncontrado } from "@/lib/origem/buscaCompras";
import {
  nomeDoDispositivo,
  paginar,
  paginasVisiveis,
  quantidadeAparelhosDaCompra,
  ROTULO_PAGAMENTO,
  type CampoOrdenacao,
  type OrdenacaoCompras,
} from "@/lib/origem/listaComprasDesktop";

export const COMPRAS_POR_PAGINA = 20;

interface TabelaComprasDesktopProps {
  /** Lista já filtrada e ordenada pela página (a mesma ordem vai para o CSV). */
  compras: CompraDispositivo[];
  loading: boolean;
  /** Há busca ou filtro: a lista vazia vira "Nenhuma compra encontrada". */
  filtroAtivo: boolean;
  aparelhosEncontrados?: Record<string, AparelhoEncontrado>;
  ordem: OrdenacaoCompras;
  onOrdenar: (campo: CampoOrdenacao) => void;
  pagina: number;
  onPagina: (pagina: number) => void;
  selecionadas: ReadonlySet<string>;
  onSelecionar: (ids: string[], marcar: boolean) => void;
  onVerDetalhes: (compra: CompraDispositivo) => void;
  onEditar: (compra: CompraDispositivo) => void;
  onExcluir: (id: string) => Promise<void>;
  onEditarDispositivo: (dispositivoId: string) => void;
  onExcluirDispositivo: (dispositivoId: string) => void;
}

const COR_PAGAMENTO: Record<string, string> = {
  pix: "bg-teal-500/10 text-teal-700 dark:text-teal-300",
  dinheiro: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  cartao_debito: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  cartao_credito: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  transferencia: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  boleto: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
};

const NOME_CAMPO: Record<CampoOrdenacao, string> = { data: "data", dispositivo: "dispositivo", valor: "valor pago" };

function ariaSort(ordem: OrdenacaoCompras, campo: CampoOrdenacao): "none" | "ascending" | "descending" {
  if (!ordem || ordem.campo !== campo) return "none";
  return ordem.direcao === "asc" ? "ascending" : "descending";
}

function rotuloOrdenar(ordem: OrdenacaoCompras, campo: CampoOrdenacao): string {
  const nome = NOME_CAMPO[campo];
  if (!ordem || ordem.campo !== campo) return `Ordenar por ${nome} em ordem crescente`;
  if (ordem.direcao === "asc") return `Ordenar por ${nome} em ordem decrescente`;
  return "Voltar à ordem padrão";
}

function CabecalhoOrdenavel({
  campo,
  rotulo,
  ordem,
  onOrdenar,
  className,
}: {
  campo: CampoOrdenacao;
  rotulo: string;
  ordem: OrdenacaoCompras;
  onOrdenar: (campo: CampoOrdenacao) => void;
  className?: string;
}) {
  const ativo = ordem?.campo === campo;
  const Icone = !ativo ? ArrowUpDown : ordem.direcao === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead aria-sort={ariaSort(ordem, campo)} className={className}>
      <button
        type="button"
        onClick={() => onOrdenar(campo)}
        aria-label={rotuloOrdenar(ordem, campo)}
        className="-mx-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {rotulo}
        <Icone className={cn("h-3.5 w-3.5", !ativo && "opacity-50")} aria-hidden="true" />
      </button>
    </TableHead>
  );
}

async function copiarImei(imei: string) {
  try {
    await navigator.clipboard.writeText(imei);
    toast.success("IMEI copiado");
  } catch {
    toast.error("Não foi possível copiar o IMEI");
  }
}

function Imei({ imei }: { imei?: string | null }) {
  if (!imei) return <span className="font-mono text-xs text-muted-foreground">N/A</span>;
  return (
    <span className="inline-flex max-w-full items-center gap-1">
      <span className="font-mono text-xs [overflow-wrap:anywhere]">{imei}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground"
        onClick={() => copiarImei(imei)}
        title="Copiar IMEI"
        aria-label={`Copiar IMEI ${imei}`}
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </span>
  );
}

const baixarRecibo = async (url: string, compraId: string): Promise<void> => {
  await downloadPDFRobust({
    url,
    filename: `recibo-legal-${compraId}.pdf`,
    onRetry: () => baixarRecibo(url, compraId),
  });
};

export function TabelaComprasDesktop({
  compras,
  loading,
  filtroAtivo,
  aparelhosEncontrados,
  ordem,
  onOrdenar,
  pagina,
  onPagina,
  selecionadas,
  onSelecionar,
  onVerDetalhes,
  onEditar,
  onExcluir,
  onEditarDispositivo,
  onExcluirDispositivo,
}: TabelaComprasDesktopProps) {
  const paginaAtual = useMemo(() => paginar(compras, pagina, COMPRAS_POR_PAGINA), [compras, pagina]);
  const idsDaPagina = paginaAtual.itens.map((c) => c.id);
  const marcadasNaPagina = idsDaPagina.filter((id) => selecionadas.has(id)).length;
  const estadoCabecalho: boolean | "indeterminate" =
    marcadasNaPagina === 0 ? false : marcadasNaPagina === idsDaPagina.length ? true : "indeterminate";

  return (
    <Card className="overflow-hidden rounded-2xl shadow-sm">
      {loading ? (
        <div className="space-y-3 p-5" aria-hidden="true">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-5 w-5 shrink-0 rounded-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/5" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-8 w-24" />
            </div>
          ))}
        </div>
      ) : compras.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ShoppingCart className="h-6 w-6" aria-hidden="true" />
          </div>
          {filtroAtivo ? (
            <p className="text-sm text-muted-foreground">Nenhuma compra encontrada</p>
          ) : (
            <div className="space-y-1">
              <p className="font-medium">Nenhuma compra registrada</p>
              <p className="text-sm text-muted-foreground">Clique em "Nova Compra" para começar</p>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* table-fixed + larguras: nomes longos quebram linha em vez de esticar a tabela.
              Abaixo de 948px de caixa (1024px de tela) a tabela rola dentro do cartão
              e as duas colunas de ações ficam presas à direita. Colunas fixas somam 608px;
              Pessoa e Dispositivo dividem o resto (no mínimo ~170px cada). */}
          <Table className="min-w-[948px] table-fixed">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[40px] pl-4 pr-0">
                  <Checkbox
                    checked={estadoCabecalho}
                    onCheckedChange={() => onSelecionar(idsDaPagina, estadoCabecalho !== true)}
                    aria-label={estadoCabecalho === true ? "Desmarcar as compras desta página" : "Selecionar as compras desta página"}
                  />
                </TableHead>
                <CabecalhoOrdenavel campo="data" rotulo="Data" ordem={ordem} onOrdenar={onOrdenar} className="w-[92px] px-2" />
                <TableHead className="px-2">Pessoa/Fornecedor</TableHead>
                <CabecalhoOrdenavel campo="dispositivo" rotulo="Dispositivo" ordem={ordem} onOrdenar={onOrdenar} className="px-2" />
                <TableHead className="hidden w-[160px] px-2 min-[1440px]:table-cell">IMEI</TableHead>
                <CabecalhoOrdenavel campo="valor" rotulo="Valor Pago" ordem={ordem} onOrdenar={onOrdenar} className="w-[120px] px-2 text-right" />
                <TableHead className="w-[112px] px-2">Pagamento</TableHead>
                <TableHead className="w-[56px] px-1 text-center">Termo</TableHead>
                <TableHead className="sticky right-[84px] z-10 w-[104px] border-l bg-card px-1.5 text-center leading-tight">
                  Ações Compra
                </TableHead>
                <TableHead className="sticky right-0 z-10 w-[84px] bg-card px-1.5 pr-3 text-center leading-tight">
                  Ações Dispositivo
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginaAtual.itens.map((compra) => {
                const nomePessoa = compra.origem_pessoas?.nome || compra.fornecedores?.nome || "N/A";
                const avatar = avatarFornecedor(compra.pessoa_id || compra.fornecedor_id || nomePessoa, nomePessoa);
                const dispositivo = nomeDoDispositivo(compra);
                const aparelhos = quantidadeAparelhosDaCompra(compra);
                const marcada = selecionadas.has(compra.id);
                const descricao = `${dispositivo || "dispositivo"} de ${formatDate(compra.data_compra)}`;
                return (
                  <TableRow key={compra.id} data-state={marcada ? "selected" : undefined}>
                    <TableCell className="pl-4 pr-0">
                      <Checkbox
                        checked={marcada}
                        onCheckedChange={(v) => onSelecionar([compra.id], v === true)}
                        aria-label={`Selecionar a compra ${descricao}`}
                      />
                    </TableCell>
                    <TableCell className="px-2 tabular-nums">{formatDate(compra.data_compra)}</TableCell>
                    <TableCell className="px-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                            avatar.classes,
                          )}
                          aria-hidden="true"
                        >
                          {avatar.iniciais}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium [overflow-wrap:anywhere]">{nomePessoa}</p>
                          {compra.origem_pessoas?.cpf_cnpj && (
                            <p className="text-xs text-muted-foreground tabular-nums [overflow-wrap:anywhere]">
                              {compra.origem_pessoas.cpf_cnpj}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-2">
                      <div className="min-w-0">
                        <p className="font-medium [overflow-wrap:anywhere]">{dispositivo || "-"}</p>
                        {compra.dispositivos?.cor && (
                          <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{compra.dispositivos.cor}</p>
                        )}
                        {aparelhos > 1 && (
                          <p className="text-xs text-muted-foreground">{aparelhos} aparelhos nesta compra</p>
                        )}
                        {aparelhosEncontrados?.[compra.id] && (
                          <p className="text-xs text-primary [overflow-wrap:anywhere]" data-testid="compra-busca-encontrado">
                            {descreverAparelhoEncontrado(aparelhosEncontrados[compra.id])}
                          </p>
                        )}
                        {/* Abaixo de 1440px o IMEI vem aqui, como 2ª linha, em vez de coluna própria. */}
                        <div className="min-[1440px]:hidden">
                          <Imei imei={compra.dispositivos?.imei} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden px-2 min-[1440px]:table-cell">
                      <Imei imei={compra.dispositivos?.imei} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-2 text-right font-medium tabular-nums">
                      <ValorMonetario valor={compra.valor_pago} tipo="preco" />
                    </TableCell>
                    <TableCell className="px-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "whitespace-nowrap border-transparent font-medium",
                          COR_PAGAMENTO[compra.forma_pagamento] ?? "bg-muted text-muted-foreground",
                        )}
                      >
                        {ROTULO_PAGAMENTO[compra.forma_pagamento] ?? compra.forma_pagamento}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-1 text-center">
                      {compra.termo_pdf_url ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => baixarRecibo(compra.termo_pdf_url!, compra.id)}
                          title="Baixar Recibo Legal"
                          aria-label={`Baixar o recibo legal da compra ${descricao}`}
                        >
                          <FileText className="h-4 w-4 text-green-600" />
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="sticky right-[84px] border-l bg-card px-1.5">
                      <div className="flex items-center justify-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onVerDetalhes(compra)}
                          title="Ver detalhes"
                          aria-label={`Ver detalhes da compra ${descricao}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onEditar(compra)}
                          title="Editar compra"
                          aria-label={`Editar a compra ${descricao}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 hover:bg-destructive/10"
                              title="Excluir compra"
                              aria-label={`Excluir a compra ${descricao}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir compra?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir esta compra? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => onExcluir(compra.id)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                    <TableCell className="sticky right-0 bg-card px-1.5 pr-3">
                      <div className="flex items-center justify-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onEditarDispositivo(compra.dispositivo_id)}
                          title="Editar dispositivo"
                          aria-label={`Editar o dispositivo ${dispositivo || "da compra"}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 hover:bg-destructive/10"
                              title="Excluir dispositivo"
                              aria-label={`Excluir o dispositivo ${dispositivo || "da compra"}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir dispositivo?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Atenção: Este dispositivo está vinculado a uma compra.
                                Você deve excluir a compra primeiro antes de excluir o dispositivo.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => onExcluirDispositivo(compra.dispositivo_id)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                Tentar Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between gap-4 border-t px-5 py-3">
            <p className="text-sm text-muted-foreground">
              Exibindo {paginaAtual.inicio} a {paginaAtual.fim} de {paginaAtual.total}{" "}
              {paginaAtual.total === 1 ? "compra" : "compras"}
            </p>
            {paginaAtual.totalPaginas > 1 && (
              <nav className="flex items-center gap-1" aria-label="Páginas da lista de compras">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => onPagina(paginaAtual.pagina - 1)}
                  disabled={paginaAtual.pagina === 1}
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {paginasVisiveis(paginaAtual.pagina, paginaAtual.totalPaginas).map((p, i) =>
                  p === "…" ? (
                    <span key={`buraco-${i}`} className="px-1 text-sm text-muted-foreground" aria-hidden="true">
                      …
                    </span>
                  ) : (
                    <Button
                      key={p}
                      variant={p === paginaAtual.pagina ? "default" : "outline"}
                      size="icon"
                      className="h-9 w-9 tabular-nums"
                      onClick={() => onPagina(p)}
                      aria-label={`Página ${p}`}
                      aria-current={p === paginaAtual.pagina ? "page" : undefined}
                    >
                      {p}
                    </Button>
                  ),
                )}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => onPagina(paginaAtual.pagina + 1)}
                  disabled={paginaAtual.pagina === paginaAtual.totalPaginas}
                  aria-label="Próxima página"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </nav>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
