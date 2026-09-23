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
import { CompraDispositivo, OrigemPessoa } from "@/types/origem";
import { formatCurrency } from "@/lib/formatters";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, User, Smartphone, DollarSign, Download, Loader2, Images, ImageOff } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { gerarReciboLegalPDF, salvarReciboStorage } from "@/lib/gerarReciboLegalPDF";
import { buscarConfiguracaoLojaPorEmpresa, validarConfiguracaoParaRecibos } from "@/hooks/useConfiguracaoLoja";
import { downloadPDFRobust } from "@/lib/downloadPDF";

interface DialogVisualizacaoCompraProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compra: CompraDispositivo | null;
}

export function DialogVisualizacaoCompra({
  open,
  onOpenChange,
  compra,
}: DialogVisualizacaoCompraProps) {
  const { toast } = useToast();
  const [gerandoPDF, setGerandoPDF] = useState(false);

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

  const handleGerarRecibo = async () => {
    if (!compra) return;

    setGerandoPDF(true);
    try {
      // Buscar configuração da loja (da filial da compra, com fallback para a matriz)
      const config = await buscarConfiguracaoLojaPorEmpresa(compra.empresa_id);

      if (!config) {
        toast({
          title: "Erro ao buscar configuração",
          description: "Não foi possível encontrar as configurações da loja. Configure os dados da loja primeiro.",
          variant: "destructive",
        });
        setGerandoPDF(false);
        return;
      }

      // Validar campos obrigatórios da loja
      // Usar validação robusta para recibos
      const validacao = validarConfiguracaoParaRecibos(config);

      if (!validacao.valido) {
        toast({
          title: "Dados da loja incompletos",
          description: `Por favor, complete os seguintes campos nas configurações: ${validacao.camposFaltando.join(", ")}. Clique para configurar.`,
          variant: "destructive",
        });
        setGerandoPDF(false);
        return;
      }

      // Buscar dados da pessoa (compra "terceiro") ou usar fornecedor (compra "fornecedor")
      let pessoaData: Partial<OrigemPessoa> & { nome: string };

      if (compra.pessoa_id) {
        const { data, error: pessoaError } = await supabase
          .from('origem_pessoas')
          .select('*')
          .eq('id', compra.pessoa_id)
          .single();

        if (pessoaError || !data) {
          toast({
            title: "Erro ao buscar vendedor",
            description: "Não foi possível encontrar os dados do vendedor",
            variant: "destructive",
          });
          setGerandoPDF(false);
          return;
        }

        pessoaData = data;
      } else if (compra.fornecedor_id) {
        pessoaData = {
          nome: compra.fornecedores?.nome || 'Fornecedor não identificado',
          cpf_cnpj: '',
          endereco: '',
          telefone: '',
        };
      } else {
        toast({
          title: "Erro",
          description: "Compra sem pessoa ou fornecedor associado",
          variant: "destructive",
        });
        setGerandoPDF(false);
        return;
      }

      // Validar campos obrigatórios do vendedor
      if (!pessoaData.nome) {
        toast({
          title: "Dados do vendedor incompletos",
          description: "Por favor, complete o nome do vendedor",
          variant: "destructive",
        });
        setGerandoPDF(false);
        return;
      }

      // Buscar dados do dispositivo
      const { data: dispositivo, error: dispositivoError } = await supabase
        .from('dispositivos')
        .select('*')
        .eq('id', compra.dispositivo_id)
        .single();

      if (dispositivoError || !dispositivo) {
        toast({
          title: "Erro ao buscar dispositivo",
          description: "Não foi possível encontrar os dados do dispositivo",
          variant: "destructive",
        });
        setGerandoPDF(false);
        return;
      }

      // Validar campos obrigatórios do dispositivo
      const camposFaltandoDispositivo: string[] = [];
      if (!dispositivo.marca) camposFaltandoDispositivo.push("Marca");
      if (!dispositivo.modelo) camposFaltandoDispositivo.push("Modelo");
      if (!dispositivo.tipo) camposFaltandoDispositivo.push("Tipo");

      if (camposFaltandoDispositivo.length > 0) {
        toast({
          title: "Dados do dispositivo incompletos",
          description: `Por favor, complete os seguintes campos: ${camposFaltandoDispositivo.join(", ")}`,
          variant: "destructive",
        });
        setGerandoPDF(false);
        return;
      }

      // Gerar PDF
      const pdf = await gerarReciboLegalPDF({
        loja: {
          nome_loja: config.nome_loja,
          razao_social: config.razao_social,
          cnpj: config.cnpj,
          endereco: config.endereco,
          telefone: config.telefone,
        },
        vendedor: pessoaData,
        dispositivo: {
          tipo: dispositivo.tipo,
          marca: dispositivo.marca,
          modelo: dispositivo.modelo,
          cor: dispositivo.cor,
          imei: dispositivo.imei,
          numero_serie: dispositivo.numero_serie,
          capacidade_gb: dispositivo.capacidade_gb,
          condicao: dispositivo.condicao,
          checklist: dispositivo.checklist as Record<string, boolean> | undefined,
        },
        compra: compra,
      });

      // Salvar no storage
      const pdfUrl = await salvarReciboStorage(pdf, compra.id);

      // Atualizar registro da compra
      const { error: updateError } = await supabase
        .from('compras_dispositivos')
        .update({ termo_pdf_url: pdfUrl })
        .eq('id', compra.id);

      if (updateError) throw updateError;

      toast({
        title: "Sucesso!",
        description: "Recibo legal gerado com sucesso",
      });

      // Baixar PDF usando método robusto
      await downloadPDFRobust({
        url: pdfUrl,
        filename: `recibo-legal-${compra.id}.pdf`,
        onRetry: () => handleGerarRecibo()
      });

      // Atualizar compra local
      if (compra) {
        compra.termo_pdf_url = pdfUrl;
      }
    } catch (error) {
      console.error('Erro ao gerar recibo:', error);
      const mensagem = error instanceof Error ? error.message : 'Erro ao gerar recibo legal';
      toast({
        title: "Erro ao gerar recibo",
        description: mensagem,
        variant: "destructive",
      });
    } finally {
      setGerandoPDF(false);
    }
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
          {compra.termo_pdf_url ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(compra.termo_pdf_url!, '_blank')}
            >
              <Download className="h-4 w-4 mr-2" />
              Baixar Recibo Legal
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleGerarRecibo}
              disabled={gerandoPDF}
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

          {/* Dados do Dispositivo */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Smartphone className="h-4 w-4" />
              <h3>Dispositivo</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Marca/Modelo:</span>
                <p className="font-medium">
                  {compra.dispositivos?.marca} {compra.dispositivos?.modelo}
                </p>
              </div>
              {compra.dispositivos?.imei && (
                <div>
                  <span className="text-muted-foreground">IMEI:</span>
                  <p className="font-medium font-mono text-xs">{compra.dispositivos.imei}</p>
                </div>
              )}
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
                  {format(new Date(compra.data_compra), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
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
          {compra.termo_pdf_url && (
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Termo de Compra</p>
                  <p className="text-xs text-muted-foreground">Documento legal da transação</p>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href={compra.termo_pdf_url} target="_blank" rel="noopener noreferrer">
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
