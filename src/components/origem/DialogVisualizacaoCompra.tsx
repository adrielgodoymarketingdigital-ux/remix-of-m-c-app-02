import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompraDispositivo, OrigemPessoa } from "@/types/origem";
import { formatCurrency } from "@/lib/formatters";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, User, Smartphone, DollarSign, Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { gerarReciboLegalPDF, salvarReciboStorage } from "@/lib/gerarReciboLegalPDF";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
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
  const { config, validarParaRecibos } = useConfiguracaoLoja();
  const [gerandoPDF, setGerandoPDF] = useState(false);

  if (!compra) return null;

  const handleGerarRecibo = async () => {
    if (!compra) return;

    setGerandoPDF(true);
    try {
      // Buscar configuração da loja com validação robusta
      const { data: config, error: configError } = await supabase
        .from("configuracoes_loja")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (configError || !config) {
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
      const validacao = validarParaRecibos();
      
      if (!validacao.valido) {
        toast({
          title: "Dados da loja incompletos",
          description: `Por favor, complete os seguintes campos nas configurações: ${validacao.camposFaltando.join(", ")}. Clique para configurar.`,
          variant: "destructive",
        });
        setGerandoPDF(false);
        return;
      }

      // Buscar dados da pessoa
      if (!compra.pessoa_id) {
        toast({
          title: "Erro",
          description: "Compra sem pessoa associada",
          variant: "destructive",
        });
        setGerandoPDF(false);
        return;
      }

      const { data: pessoaData, error: pessoaError } = await supabase
        .from('origem_pessoas')
        .select('*')
        .eq('id', compra.pessoa_id)
        .single();

      if (pessoaError || !pessoaData) {
        toast({
          title: "Erro ao buscar vendedor",
          description: "Não foi possível encontrar os dados do vendedor",
          variant: "destructive",
        });
        setGerandoPDF(false);
        return;
      }

      // Validar campos obrigatórios do vendedor
      const camposFaltandoVendedor: string[] = [];
      if (!pessoaData.nome) camposFaltandoVendedor.push("Nome do vendedor");
      if (!pessoaData.cpf_cnpj) camposFaltandoVendedor.push("CPF/CNPJ do vendedor");

      if (camposFaltandoVendedor.length > 0) {
        toast({
          title: "Dados do vendedor incompletos",
          description: `Por favor, complete os seguintes campos: ${camposFaltandoVendedor.join(", ")}`,
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

      // Converter tipo de pessoa
      const pessoa: OrigemPessoa = {
        ...pessoaData,
        tipo: pessoaData.tipo as 'fisica' | 'juridica',
      };

      // Gerar PDF
      const pdf = await gerarReciboLegalPDF({
        loja: {
          nome_loja: config.nome_loja,
          razao_social: config.razao_social,
          cnpj: config.cnpj,
          endereco: config.endereco,
          telefone: config.telefone,
        },
        vendedor: pessoa,
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
      toast({
        title: "Erro",
        description: "Erro ao gerar recibo legal",
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
  );
}
