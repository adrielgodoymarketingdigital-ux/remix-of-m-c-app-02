import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompraDispositivo } from "@/types/origem";
import { formatCurrency, parseDate } from "@/lib/formatters";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, FilePlus2, User, Smartphone, DollarSign, Download, Loader2, Images, ImageOff } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { downloadPDFRobust } from "@/lib/downloadPDF";
import { useGerarReciboLegal } from "@/hooks/useGerarReciboLegal";
import { useQuery } from "@tanstack/react-query";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import {
  ordenarDispositivosDaCompra,
  statusDispositivoCompra,
  totalDaCompra,
  type StatusDispositivoCompra,
} from "@/lib/origem/itensCompra";

const CONDICOES: Record<string, string> = { novo: "Novo", semi_novo: "Semi Novo", usado: "Usado" };

const STATUS: Record<StatusDispositivoCompra, { rotulo: string; variante: "default" | "secondary" | "destructive" }> = {
  em_estoque: { rotulo: "Em estoque", variante: "default" },
  vendido: { rotulo: "Vendido", variante: "secondary" },
  excluido: { rotulo: "Excluído", variante: "destructive" },
};

interface DispositivoDaCompra {
  id: string;
  marca: string | null;
  modelo: string | null;
  cor: string | null;
  capacidade_gb: number | null;
  imei: string | null;
  imei2: string | null;
  numero_serie: string | null;
  condicao: string | null;
  custo: number | null;
  preco: number | null;
  vendido: boolean | null;
  deleted_at: string | null;
  created_at: string | null;
}

/** Todos os aparelhos da compra: o principal (dispositivo_id) e os que têm compra_id = compra. */
async function buscarDispositivosDaCompra(compraId: string, principalId: string | null): Promise<DispositivoDaCompra[]> {
  let query = supabase
    .from("dispositivos")
    .select("id, marca, modelo, cor, capacidade_gb, imei, imei2, numero_serie, condicao, custo, preco, vendido, deleted_at, created_at");
  query = principalId
    ? query.or(`compra_id.eq.${compraId},id.eq.${principalId}`)
    : query.eq("compra_id", compraId);
  const { data, error } = await query;
  if (error) throw error;
  return ordenarDispositivosDaCompra((data ?? []) as DispositivoDaCompra[], principalId);
}

interface DialogVisualizacaoCompraProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compra: CompraDispositivo | null;
  /** Depois de gerar um recibo novo: recarrega a lista. */
  onReciboGerado?: () => void;
}

export function DialogVisualizacaoCompra({
  open,
  onOpenChange,
  compra,
  onReciboGerado,
}: DialogVisualizacaoCompraProps) {
  const { podeVerCustos } = useFuncionarioPermissoes();
  const { gerar, gerando, t } = useGerarReciboLegal();
  // Link do recibo gerado agora (vale só para a compra em que foi gerado).
  const [termoGerado, setTermoGerado] = useState<{ compraId: string; url: string } | null>(null);

  const { data: dispositivosDaCompra, isLoading: carregandoDispositivos } = useQuery({
    queryKey: ["compra-dispositivos", compra?.id, compra?.dispositivo_id],
    queryFn: () => buscarDispositivosDaCompra(compra!.id, compra!.dispositivo_id ?? null),
    enabled: open && !!compra?.id,
    // Status (vendido/excluído) e dados mudam por outras telas: busca de novo a cada abertura.
    staleTime: 0,
  });

  // Galeria de fotos da compra — grade de thumbnails + lightbox (Carousel)
  // que abre por cima ao clicar. fotosComErro rastreia fotos cuja URL
  // assinada expirou (dura 1 ano no bucket compras-fotos) pra mostrar um
  // aviso em vez de imagem quebrada; fotosCarregadas evita o "pulo" de
  // layout mostrando um skeleton até o onLoad disparar.
  const [fotoAmpliadaIndex, setFotoAmpliadaIndex] = useState<number | null>(null);
  const [fotosComErro, setFotosComErro] = useState<Set<number>>(new Set());
  const [fotosCarregadas, setFotosCarregadas] = useState<Set<number>>(new Set());
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [indiceAtual, setIndiceAtual] = useState(0);

  useEffect(() => {
    setFotosComErro(new Set());
    setFotosCarregadas(new Set());
    setFotoAmpliadaIndex(null);
  }, [compra?.id]);

  useEffect(() => {
    if (!carouselApi) return;
    setIndiceAtual(carouselApi.selectedScrollSnap());
    const aoSelecionar = () => setIndiceAtual(carouselApi.selectedScrollSnap());
    carouselApi.on("select", aoSelecionar);
    return () => {
      carouselApi.off("select", aoSelecionar);
    };
  }, [carouselApi]);

  const marcarFotoComErro = (index: number) => {
    setFotosComErro((prev) => new Set(prev).add(index));
  };

  const marcarFotoCarregada = (index: number) => {
    setFotosCarregadas((prev) => new Set(prev).add(index));
  };

  if (!compra) return null;

  const listaDispositivos = dispositivosDaCompra ?? [];
  const termoPdfUrl = termoGerado?.compraId === compra.id ? termoGerado.url : compra.termo_pdf_url;
  const gerandoPDF = gerando(compra.id);
  const resumo = totalDaCompra(listaDispositivos);

  // Sempre um recibo NOVO, lido do banco com as fotos e anexos atuais. O link novo
  // fica no estado local (o objeto da prop não é alterado) e a lista recarrega.
  const handleGerarRecibo = async () => {
    await gerar(compra.id, async (resultado) => {
      setTermoGerado({ compraId: compra.id, url: resultado.url });
      onReciboGerado?.();
      await downloadPDFRobust({
        url: resultado.url,
        filename: `recibo-legal-${compra.id}.pdf`,
        onRetry: () => downloadPDFRobust({ url: resultado.url, filename: `recibo-legal-${compra.id}.pdf` }),
      });
    });
  };

  const formatarFormaPagamento = (forma: string) => {
    const formas: Record<string, string> = {
      pix: 'PIX',
      dinheiro: 'Dinheiro',
      cartao_debito: 'Cartão de Débito',
      cartao_credito: 'Cartão de Crédito',
      transferencia: 'Transferência Bancária',
      boleto: 'Boleto'
    };
    return formas[forma] || forma;
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl sm:max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <div className="flex items-center justify-between">
          <DialogTitle>Detalhes da Compra</DialogTitle>
          {termoPdfUrl ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(termoPdfUrl, '_blank')}
              >
                <Download className="h-4 w-4 mr-2" />
                Baixar Recibo Legal
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGerarRecibo}
                disabled={gerandoPDF}
                title={t("reciboLegal.gerarNovoFotos")}
                data-testid="recibo-gerar"
              >
                {gerandoPDF ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t("reciboLegal.gerandoBotao")}
                  </>
                ) : (
                  <>
                    <FilePlus2 className="h-4 w-4 mr-2" />
                    {t("reciboLegal.gerarNovo")}
                  </>
                )}
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleGerarRecibo}
              disabled={gerandoPDF}
              data-testid="recibo-gerar"
            >
              {gerandoPDF ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Gerar Recibo Legal
                </>
              )}
            </Button>
          )}
        </div>
      </DialogHeader>

        <div className="space-y-6">
          {/* Total da compra */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-lg border bg-muted/40 p-3 text-sm" data-testid="compra-visualizar-total">
            <div>
              <span className="text-muted-foreground text-xs">Dispositivos</span>
              <p className="font-bold text-lg">{carregandoDispositivos && listaDispositivos.length === 0 ? "…" : Math.max(resumo.quantidade, 1)}</p>
            </div>
            {podeVerCustos && (
              <div>
                <span className="text-muted-foreground text-xs">Soma dos custos</span>
                <p className="font-bold text-lg">{listaDispositivos.length > 0 ? formatCurrency(resumo.somaCustos) : "-"}</p>
              </div>
            )}
            <div>
              <span className="text-muted-foreground text-xs">Valor pago</span>
              <p className="font-bold text-lg"><ValorMonetario valor={compra.valor_pago} /></p>
            </div>
          </div>

          {/* Dados da Pessoa/Fornecedor */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <User className="h-4 w-4" />
              <h3>Vendedor</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Nome:</span>
                <p className="font-medium">
                  {compra.origem_pessoas?.nome || compra.fornecedores?.nome}
                </p>
              </div>
              {compra.origem_pessoas?.cpf_cnpj && (
                <div>
                  <span className="text-muted-foreground">CPF/CNPJ:</span>
                  <p className="font-medium">{compra.origem_pessoas.cpf_cnpj}</p>
                </div>
              )}
              {compra.origem_pessoas?.telefone && (
                <div>
                  <span className="text-muted-foreground">Telefone:</span>
                  <p className="font-medium">{compra.origem_pessoas.telefone}</p>
                </div>
              )}
              {compra.origem_pessoas?.endereco && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Endereço:</span>
                  <p className="font-medium">{compra.origem_pessoas.endereco}</p>
                </div>
              )}
            </div>
          </div>

          {/* Dispositivos da compra (todos; compra antiga mostra o único) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Smartphone className="h-4 w-4" />
              <h3>{listaDispositivos.length > 1 ? `Dispositivos (${listaDispositivos.length})` : "Dispositivo"}</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Condição:</span>
                <p className="font-medium">{compra.condicao_aparelho}</p>
              </div>
              {compra.situacao_conta && (
                <div>
                  <span className="text-muted-foreground">Situação Conta:</span>
                  <p className="font-medium">{compra.situacao_conta}</p>
                </div>
              )}
            </div>
            {carregandoDispositivos && listaDispositivos.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando dispositivos...
              </div>
            ) : listaDispositivos.length === 0 ? (
              // Sem acesso aos aparelhos (ex.: excluídos de vez): mostra o que veio com a compra.
              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium">{compra.dispositivos?.marca} {compra.dispositivos?.modelo}</p>
                {compra.dispositivos?.imei && <p className="font-mono text-xs text-muted-foreground">IMEI {compra.dispositivos.imei}</p>}
              </div>
            ) : (
              <div className="space-y-2">
                {listaDispositivos.map((d, idx) => {
                  const status = STATUS[statusDispositivoCompra(d)];
                  return (
                    <div key={d.id} className="rounded-md border p-3 text-sm" data-testid="compra-visualizar-dispositivo">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium">
                          {listaDispositivos.length > 1 && <span className="text-muted-foreground mr-1">{idx + 1}.</span>}
                          {[d.marca, d.modelo].filter(Boolean).join(" ") || "Dispositivo"}
                        </p>
                        <Badge variant={status.variante} className="shrink-0">{status.rotulo}</Badge>
                      </div>
                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1">
                        <div>
                          <span className="text-muted-foreground text-xs">IMEI:</span>
                          <p className="font-mono text-xs break-all">{d.imei || "-"}{d.imei2 ? ` / ${d.imei2}` : ""}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs">Nº de série:</span>
                          <p className="font-mono text-xs break-all">{d.numero_serie || "-"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs">Cor:</span>
                          <p>{d.cor || "-"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs">Capacidade:</span>
                          <p>{d.capacidade_gb ? `${d.capacidade_gb} GB` : "-"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs">Condição:</span>
                          <p>{(d.condicao && CONDICOES[d.condicao]) || d.condicao || "-"}</p>
                        </div>
                        {podeVerCustos && (
                          <div>
                            <span className="text-muted-foreground text-xs">Custo:</span>
                            <p className="font-medium">{d.custo != null ? formatCurrency(d.custo) : "-"}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Dados da Transação */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <DollarSign className="h-4 w-4" />
              <h3>Transação</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Data da Compra:</span>
                <p className="font-medium">
                  {format(parseDate(compra.data_compra), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Valor Pago:</span>
                <p className="font-bold text-lg"><ValorMonetario valor={compra.valor_pago} /></p>
              </div>
              <div>
                <span className="text-muted-foreground">Forma de Pagamento:</span>
                <div className="mt-1">
                  <Badge variant="outline">
                    {formatarFormaPagamento(compra.forma_pagamento)}
                  </Badge>
                </div>
              </div>
              {compra.funcionario_responsavel && (
                <div>
                  <span className="text-muted-foreground">Funcionário:</span>
                  <p className="font-medium">{compra.funcionario_responsavel}</p>
                </div>
              )}
              {compra.unidade && (
                <div>
                  <span className="text-muted-foreground">Unidade:</span>
                  <p className="font-medium">{compra.unidade}</p>
                </div>
              )}
            </div>
          </div>

          {/* Fotos */}
          {compra.fotos && compra.fotos.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Images className="h-4 w-4" />
                <h3>Fotos ({compra.fotos.length})</h3>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {compra.fotos.map((url, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setFotoAmpliadaIndex(index)}
                    className="relative aspect-square rounded-lg overflow-hidden border border-border/40 hover:border-primary/40 transition-colors bg-muted"
                  >
                    {fotosComErro.has(index) ? (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-muted-foreground p-1">
                        <ImageOff className="h-5 w-5" />
                        <span className="text-[9px] text-center leading-tight">Expirada</span>
                      </div>
                    ) : (
                      <>
                        {!fotosCarregadas.has(index) && (
                          <div className="absolute inset-0 bg-muted animate-pulse" />
                        )}
                        <img
                          src={url}
                          alt={`Foto ${index + 1}`}
                          loading="lazy"
                          decoding="async"
                          onLoad={() => marcarFotoCarregada(index)}
                          onError={() => marcarFotoComErro(index)}
                          className="w-full h-full object-cover"
                        />
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Observações */}
          {compra.observacoes && (
            <div className="space-y-2">
              <span className="text-sm text-muted-foreground">Observações:</span>
              <p className="text-sm p-3 bg-muted rounded-md">{compra.observacoes}</p>
            </div>
          )}

          {/* Termo PDF */}
          {termoPdfUrl && (
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Termo de Compra</p>
                  <p className="text-xs text-muted-foreground">Documento legal da transação</p>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href={termoPdfUrl} target="_blank" rel="noopener noreferrer">
                  Abrir PDF
                </a>
              </Button>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Lightbox de fotos — Dialog separado, empilha por cima do de detalhes.
        Carousel só monta quando o lightbox abre, então startIndex sempre
        aponta pra foto certa a cada abertura. */}
    <Dialog open={fotoAmpliadaIndex !== null} onOpenChange={(o) => !o && setFotoAmpliadaIndex(null)}>
      <DialogContent className="max-w-3xl p-2 sm:p-6">
        {fotoAmpliadaIndex !== null && compra.fotos && compra.fotos.length > 0 && (
          <>
            <Carousel opts={{ startIndex: fotoAmpliadaIndex }} setApi={setCarouselApi} className="w-full">
              <CarouselContent>
                {compra.fotos.map((url, index) => (
                  <CarouselItem key={index}>
                    <div className="aspect-square sm:aspect-video flex items-center justify-center bg-black/5 rounded-lg overflow-hidden">
                      {fotosComErro.has(index) ? (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <ImageOff className="h-10 w-10" />
                          <span className="text-sm">Imagem expirada</span>
                        </div>
                      ) : (
                        <img
                          src={url}
                          alt={`Foto ${index + 1}`}
                          loading="lazy"
                          decoding="async"
                          onError={() => marcarFotoComErro(index)}
                          className="max-h-full max-w-full object-contain"
                        />
                      )}
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {compra.fotos.length > 1 && (
                <>
                  <CarouselPrevious className="left-2" />
                  <CarouselNext className="right-2" />
                </>
              )}
            </Carousel>
            {compra.fotos.length > 1 && (
              <div className="text-center text-sm text-muted-foreground mt-2">
                {indiceAtual + 1} / {compra.fotos.length}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
