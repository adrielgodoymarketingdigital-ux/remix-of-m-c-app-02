import { useState } from "react";
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
import { Eye, FileText, Edit, Trash2, Loader2 } from "lucide-react";
import { CompraDispositivo } from "@/types/origem";
import { formatCurrency } from "@/lib/formatters";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { gerarReciboLegalPDF, salvarReciboStorage } from "@/lib/gerarReciboLegalPDF";
import { supabase } from "@/integrations/supabase/client";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { downloadPDFRobust } from "@/lib/downloadPDF";

interface TabelaComprasProps {
  compras: CompraDispositivo[];
  loading: boolean;
  onVerDetalhes: (compra: CompraDispositivo) => void;
  onEditar: (compra: CompraDispositivo) => void;
  onExcluir: (id: string) => Promise<void>;
  onEditarDispositivo?: (dispositivoId: string) => void;
  onExcluirDispositivo?: (dispositivoId: string) => void;
}

export function TabelaCompras({
  compras,
  loading,
  onVerDetalhes,
  onEditar,
  onExcluir,
  onEditarDispositivo,
  onExcluirDispositivo,
}: TabelaComprasProps) {
  const [compraParaExcluir, setCompraParaExcluir] = useState<string | null>(null);
  const [gerandoRecibo, setGerandoRecibo] = useState<Record<string, boolean>>({});
  const { config, validarParaRecibos } = useConfiguracaoLoja();

  const handleGerarRecibo = async (compra: CompraDispositivo) => {
    try {
      setGerandoRecibo(prev => ({ ...prev, [compra.id]: true }));
      
      // Validar configuração da loja
      if (!config) {
        toast.error("Configure os dados da loja primeiro");
        return;
      }

      // Usar validação robusta para recibos
      const validacao = validarParaRecibos();
      
      if (!validacao.valido) {
        toast.error(
          `Complete os dados da loja antes de gerar recibos. Faltam: ${validacao.camposFaltando.join(", ")}`,
          {
            action: {
              label: "Configurar",
              onClick: () => window.location.href = "/configuracoes"
            }
          }
        );
        return;
      }

      // Buscar dados completos da pessoa/fornecedor
      const vendedor = compra.origem_pessoas || {
        nome: compra.fornecedores?.nome || 'Vendedor não identificado',
        cpf_cnpj: '',
        endereco: '',
        telefone: '',
      };

      // Buscar dados completos do dispositivo
      const { data: dispositivo, error: errorDispositivo } = await supabase
        .from('dispositivos')
        .select('*')
        .eq('id', compra.dispositivo_id)
        .single();

      if (errorDispositivo || !dispositivo) {
        toast.error("Erro ao buscar dados do dispositivo");
        return;
      }

      // Gerar PDF
      toast.loading("Gerando recibo legal...");
      const pdf = await gerarReciboLegalPDF({
        loja: config as any,
        vendedor: vendedor as any,
        dispositivo: {
          tipo: dispositivo.tipo,
          marca: dispositivo.marca,
          modelo: dispositivo.modelo,
          cor: dispositivo.cor,
          imei: dispositivo.imei,
          numero_serie: dispositivo.numero_serie,
          capacidade_gb: dispositivo.capacidade_gb,
          condicao: dispositivo.condicao,
          checklist: (dispositivo.checklist as any)?.entrada,
        },
        compra: compra as any,
      });

      // Salvar no storage
      const pdfUrl = await salvarReciboStorage(pdf, compra.id);

      // Atualizar banco de dados
      const { error: errorUpdate } = await supabase
        .from('compras_dispositivos')
        .update({ termo_pdf_url: pdfUrl })
        .eq('id', compra.id);

      if (errorUpdate) throw errorUpdate;

      toast.dismiss();
      toast.success("Recibo gerado com sucesso!");

      // Baixar PDF usando método robusto
      await downloadPDFRobust({
        url: pdfUrl,
        filename: `recibo-legal-${compra.id}.pdf`,
        onRetry: () => handleGerarRecibo(compra)
      });
    } catch (error: any) {
      console.error("Erro ao gerar recibo:", error);
      toast.dismiss();
      toast.error(error.message || "Erro ao gerar recibo");
    } finally {
      setGerandoRecibo(prev => ({ ...prev, [compra.id]: false }));
    }
  };

  const handleBaixarRecibo = async (url: string, compraId: string) => {
    await downloadPDFRobust({
      url,
      filename: `recibo-legal-${compraId}.pdf`,
      onRetry: () => handleBaixarRecibo(url, compraId)
    });
  };

  const confirmarExclusao = async () => {
    if (!compraParaExcluir) return;
    
    try {
      await onExcluir(compraParaExcluir);
      toast.success("Compra excluída com sucesso!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir compra");
    } finally {
      setCompraParaExcluir(null);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (compras.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg">Nenhuma compra registrada</p>
        <p className="text-sm mt-2">
          Clique em "Nova Compra" para começar
        </p>
      </div>
    );
  }

  const formatarFormaPagamento = (forma: string) => {
    const formas: Record<string, string> = {
      pix: 'PIX',
      dinheiro: 'Dinheiro',
      cartao_debito: 'Débito',
      cartao_credito: 'Crédito',
      transferencia: 'Transferência',
      boleto: 'Boleto'
    };
    return formas[forma] || forma;
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Pessoa/Fornecedor</TableHead>
            <TableHead>Dispositivo</TableHead>
            <TableHead>IMEI</TableHead>
            <TableHead className="text-right">Valor Pago</TableHead>
            <TableHead>Pagamento</TableHead>
            <TableHead className="text-center">Termo</TableHead>
            <TableHead className="text-center">Ações Compra</TableHead>
            {(onEditarDispositivo || onExcluirDispositivo) && (
              <TableHead className="text-center">Ações Dispositivo</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {compras.map((compra) => (
            <TableRow key={compra.id}>
              <TableCell>
                {format(new Date(compra.data_compra), "dd/MM/yyyy", { locale: ptBR })}
              </TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">
                    {compra.origem_pessoas?.nome || compra.fornecedores?.nome || 'N/A'}
                  </div>
                  {compra.origem_pessoas?.cpf_cnpj && (
                    <div className="text-xs text-muted-foreground">
                      {compra.origem_pessoas.cpf_cnpj}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">
                    {compra.dispositivos?.marca} {compra.dispositivos?.modelo}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-xs font-mono">
                  {compra.dispositivos?.imei || 'N/A'}
                </span>
              </TableCell>
              <TableCell className="text-right font-medium">
                <ValorMonetario valor={compra.valor_pago} tipo="preco" />
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {formatarFormaPagamento(compra.forma_pagamento)}
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                {compra.termo_pdf_url ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleBaixarRecibo(compra.termo_pdf_url!, compra.id)}
                    title="Baixar Recibo Legal"
                  >
                    <FileText className="h-4 w-4 text-green-600" />
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onVerDetalhes(compra)}
                    title="Ver detalhes"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditar(compra)}
                    title="Editar compra"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" title="Excluir compra">
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
              
              {/* Ações do Dispositivo */}
              {(onEditarDispositivo || onExcluirDispositivo) && (
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    {onEditarDispositivo && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditarDispositivo(compra.dispositivo_id)}
                        title="Editar dispositivo"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    
                    {onExcluirDispositivo && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" title="Excluir dispositivo">
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
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
