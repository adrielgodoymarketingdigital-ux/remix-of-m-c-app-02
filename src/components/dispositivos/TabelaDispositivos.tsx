import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Edit, Trash2, ShoppingCart, FileText, Download, Loader2, ImageIcon, Lock } from "lucide-react";
import { Dispositivo } from "@/types/dispositivo";
import { formatCurrency } from "@/lib/formatters";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { gerarReciboLegalPDF, salvarReciboStorage } from "@/lib/gerarReciboLegalPDF";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { useIsMobile } from "@/hooks/use-mobile";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";

interface TabelaDispositivosProps {
  dispositivos: Dispositivo[];
  onEditar: (dispositivo: Dispositivo) => void;
  onExcluir: (id: string) => void;
}

const getTipoBadgeColor = (tipo: string) => {
  const cores: Record<string, string> = {
    "Celular": "bg-blue-500",
    "Tablet": "bg-purple-500",
    "Notebook/Computador": "bg-green-500",
    "Relógio Smart": "bg-pink-500",
  };
  return cores[tipo] || "bg-gray-500";
};

export function TabelaDispositivos({
  dispositivos,
  onEditar,
  onExcluir,
}: TabelaDispositivosProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [recibosStatus, setRecibosStatus] = useState<Record<string, { temRecibo: boolean; compraId: string | null }>>({});
  const [gerandoRecibo, setGerandoRecibo] = useState<string | null>(null);
  const { toast } = useToast();
  const { config, loading: loadingConfig, validarDadosObrigatorios } = useConfiguracaoLoja();
  const { podeVerCustos, podeVerLucros } = useFuncionarioPermissoes();

  useEffect(() => {
    const verificarRecibos = async () => {
      const dispositivosTerceiros = dispositivos.filter(d => d.origem_tipo === 'terceiro');
      const statusMap: Record<string, { temRecibo: boolean; compraId: string | null }> = {};

      for (const dispositivo of dispositivosTerceiros) {
        const { data, error } = await supabase
          .from('compras_dispositivos')
          .select('id, termo_pdf_url')
          .eq('dispositivo_id', dispositivo.id)
          .maybeSingle();
        
        if (!error && data) {
          statusMap[dispositivo.id] = {
            temRecibo: !!data.termo_pdf_url,
            compraId: data.id,
          };
        }
      }

      setRecibosStatus(statusMap);
    };

    verificarRecibos();
  }, [dispositivos]);

  const handleGerarReciboLegal = async (dispositivo: Dispositivo) => {
    const status = recibosStatus[dispositivo.id];
    if (!status?.compraId) {
      toast({
        title: "Erro",
        description: "Compra não encontrada para este dispositivo",
        variant: "destructive",
      });
      return;
    }

    setGerandoRecibo(dispositivo.id);
    try {
      if (loadingConfig) {
        toast({
          title: "Aguarde",
          description: "Carregando configurações da loja...",
        });
        setGerandoRecibo(null);
        return;
      }

      const validacao = validarDadosObrigatorios();
      if (!validacao.valido) {
        toast({
          title: "Dados da loja incompletos",
          description: `Por favor, complete os seguintes campos nas configurações: ${validacao.camposFaltando.join(", ")}`,
          variant: "destructive",
        });
        setGerandoRecibo(null);
        return;
      }

      const { data: compra, error: compraError } = await supabase
        .from("compras_dispositivos")
        .select("*, origem_pessoas(*)")
        .eq("id", status.compraId)
        .single();

      if (compraError || !compra) {
        toast({
          title: "Erro",
          description: "Não foi possível encontrar os dados da compra",
          variant: "destructive",
        });
        setGerandoRecibo(null);
        return;
      }

      if (!compra.origem_pessoas?.nome || !compra.origem_pessoas?.cpf_cnpj) {
        toast({
          title: "Dados do vendedor incompletos",
          description: "Por favor, complete os dados do vendedor (Nome e CPF/CNPJ)",
          variant: "destructive",
        });
        setGerandoRecibo(null);
        return;
      }

      toast({
        title: "Gerando recibo...",
        description: "Por favor, aguarde",
      });

      const pdf = await gerarReciboLegalPDF({
        loja: config!,
        vendedor: compra.origem_pessoas as any,
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

      const pdfUrl = await salvarReciboStorage(pdf, status.compraId);

      if (!pdfUrl) {
        throw new Error("Erro ao salvar PDF no storage");
      }

      const { error: updateError } = await supabase
        .from("compras_dispositivos")
        .update({ termo_pdf_url: pdfUrl })
        .eq("id", status.compraId);

      if (updateError) {
        throw updateError;
      }

      setRecibosStatus(prev => ({
        ...prev,
        [dispositivo.id]: { ...prev[dispositivo.id], temRecibo: true }
      }));

      toast({
        title: "Sucesso!",
        description: "Recibo legal gerado com sucesso",
      });

      window.open(pdfUrl, "_blank");
    } catch (error) {
      console.error("Erro ao gerar recibo:", error);
      toast({
        title: "Erro ao gerar recibo",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setGerandoRecibo(null);
    }
  };

  const handleBaixarRecibo = async (dispositivo: Dispositivo) => {
    const status = recibosStatus[dispositivo.id];
    if (!status?.compraId) return;

    try {
      const { data } = await supabase
        .from("compras_dispositivos")
        .select("termo_pdf_url")
        .eq("id", status.compraId)
        .single();

      if (data?.termo_pdf_url) {
        window.open(data.termo_pdf_url, "_blank");
      }
    } catch (error) {
      console.error("Erro ao baixar recibo:", error);
      toast({
        title: "Erro",
        description: "Não foi possível abrir o recibo",
        variant: "destructive",
      });
    }
  };

  if (dispositivos.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg">Nenhum dispositivo cadastrado</p>
        <p className="text-sm mt-2">
          Clique em "Novo Dispositivo" para começar
        </p>
      </div>
    );
  }

  // Mobile: Card-based layout
  if (isMobile) {
    return (
      <div className="space-y-3">
        {dispositivos.map((dispositivo) => (
          <Card key={dispositivo.id} className="p-4">
            <div className="flex gap-3 mb-3">
              <div className="w-16 h-16 rounded-md overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
                {(dispositivo.fotos && dispositivo.fotos.length > 0) || dispositivo.foto_url ? (
                  <img
                    src={dispositivo.fotos?.[0] || dispositivo.foto_url || ''}
                    alt={`${dispositivo.marca} ${dispositivo.modelo}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{dispositivo.marca} {dispositivo.modelo}</p>
                    <p className="text-sm text-muted-foreground">{dispositivo.tipo}</p>
                  </div>
                  <Badge className={`${getTipoBadgeColor(dispositivo.tipo)} text-white text-xs`}>
                    {dispositivo.quantidade}
                  </Badge>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <div>
                <span className="text-muted-foreground">Custo:</span>
                <span className="ml-1">
                  {podeVerCustos 
                    ? (dispositivo.custo ? <ValorMonetario valor={dispositivo.custo} /> : "-")
                    : <Lock className="inline h-3 w-3 text-muted-foreground" />
                  }
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Preço:</span>
                <span className="ml-1 font-medium">{dispositivo.preco ? <ValorMonetario valor={dispositivo.preco} tipo="preco" /> : "-"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Lucro:</span>
                <span className={`ml-1 font-medium ${dispositivo.lucro && dispositivo.lucro >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {podeVerLucros
                    ? (dispositivo.lucro ? <ValorMonetario valor={dispositivo.lucro} /> : "-")
                    : <Lock className="inline h-3 w-3 text-muted-foreground" />
                  }
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Capacidade:</span>
                <span className="ml-1">{dispositivo.capacidade_gb ? `${dispositivo.capacidade_gb}GB` : "-"}</span>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/pdv', { state: { dispositivoSelecionado: dispositivo } })}
                disabled={dispositivo.quantidade === 0}
                className="h-9"
              >
                <ShoppingCart className="h-4 w-4 mr-1" />
                Vender
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEditar(dispositivo)}
                className="h-9"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-9">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="mx-4 max-w-[calc(100%-2rem)]">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                    <AlertDialogDescription>
                      Excluir "{dispositivo.marca} {dispositivo.modelo}"?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                    <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onExcluir(dispositivo.id)}
                      className="w-full sm:w-auto bg-destructive text-destructive-foreground"
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  // Desktop: Table layout
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">Foto</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Condição</TableHead>
            <TableHead>Marca/Modelo</TableHead>
            <TableHead>Capacidade</TableHead>
            <TableHead className="text-center">Qtd</TableHead>
            <TableHead>IMEI/Série</TableHead>
            <TableHead className="text-center">Garantia</TableHead>
            <TableHead className="text-center">Origem</TableHead>
            <TableHead className="text-right">Custo</TableHead>
            <TableHead className="text-right">Preço</TableHead>
            <TableHead className="text-right">Lucro</TableHead>
            <TableHead className="text-center w-[130px]">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dispositivos.map((dispositivo) => (
            <TableRow key={dispositivo.id}>
              <TableCell>
                <div className="w-16 h-16 rounded-md overflow-hidden bg-muted flex items-center justify-center">
                  {(dispositivo.fotos && dispositivo.fotos.length > 0) || dispositivo.foto_url ? (
                    <img
                      src={dispositivo.fotos?.[0] || dispositivo.foto_url || ''}
                      alt={`${dispositivo.marca} ${dispositivo.modelo}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge className={`${getTipoBadgeColor(dispositivo.tipo)} text-white`}>
                  {dispositivo.tipo}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={
                  dispositivo.condicao === 'novo' ? 'default' :
                  dispositivo.condicao === 'semi_novo' ? 'secondary' :
                  'outline'
                }>
                  {dispositivo.condicao === 'novo' ? 'Novo' :
                   dispositivo.condicao === 'semi_novo' ? 'Semi Novo' :
                   'Usado'}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="font-medium">{dispositivo.marca}</div>
                <div className="text-sm text-muted-foreground">
                  {dispositivo.modelo}
                </div>
                {dispositivo.subtipo_computador && (
                  <div className="text-xs text-muted-foreground">
                    {dispositivo.subtipo_computador}
                  </div>
                )}
              </TableCell>
              <TableCell>
                {dispositivo.capacidade_gb ? `${dispositivo.capacidade_gb} GB` : "-"}
              </TableCell>
              <TableCell className="text-center">
                <Badge variant={dispositivo.quantidade > 0 ? "default" : "destructive"}>
                  {dispositivo.quantidade}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  {dispositivo.imei && <div>IMEI: {dispositivo.imei}</div>}
                  {dispositivo.numero_serie && <div>S/N: {dispositivo.numero_serie}</div>}
                  {!dispositivo.imei && !dispositivo.numero_serie && "-"}
                </div>
              </TableCell>
              <TableCell className="text-center">
                {dispositivo.garantia ? (
                  <div className="flex flex-col items-center gap-1">
                    <Badge variant="default" className="bg-green-600">
                      Sim
                    </Badge>
                    {dispositivo.tempo_garantia && (
                      <span className="text-xs text-muted-foreground">
                        {dispositivo.tempo_garantia} meses
                      </span>
                    )}
                  </div>
                ) : (
                  <Badge variant="secondary">Não</Badge>
                )}
              </TableCell>
              <TableCell className="text-center">
                {(dispositivo as any).origem_tipo ? (
                  <Badge variant={
                    (dispositivo as any).origem_tipo === 'terceiro' ? 'default' :
                    (dispositivo as any).origem_tipo === 'fornecedor' ? 'secondary' :
                    'outline'
                  }>
                    {(dispositivo as any).origem_tipo === 'terceiro' && '👤 Terceiro'}
                    {(dispositivo as any).origem_tipo === 'fornecedor' && '🏢 Fornecedor'}
                    {(dispositivo as any).origem_tipo === 'estoque_proprio' && '📦 Estoque'}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-sm">-</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {podeVerCustos
                  ? (dispositivo.custo ? <ValorMonetario valor={dispositivo.custo} /> : "-")
                  : <span className="flex items-center justify-end gap-1 text-muted-foreground"><Lock className="h-3 w-3" /></span>
                }
              </TableCell>
              <TableCell className="text-right">
                {dispositivo.preco ? <ValorMonetario valor={dispositivo.preco} tipo="preco" /> : "-"}
              </TableCell>
              <TableCell className="text-right">
                {podeVerLucros ? (
                  dispositivo.lucro !== undefined && dispositivo.lucro !== null ? (
                    <span
                      className={
                        dispositivo.lucro >= 0 ? "text-green-600" : "text-red-600"
                      }
                    >
                      <ValorMonetario valor={dispositivo.lucro} />
                    </span>
                  ) : "-"
                ) : (
                  <span className="flex items-center justify-end gap-1 text-muted-foreground"><Lock className="h-3 w-3" /></span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-center gap-2">
                  {dispositivo.origem_tipo === 'terceiro' && recibosStatus[dispositivo.id] && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {recibosStatus[dispositivo.id].temRecibo ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleBaixarRecibo(dispositivo)}
                              disabled={gerandoRecibo === dispositivo.id}
                              className="text-green-600 hover:text-green-700"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleGerarReciboLegal(dispositivo)}
                              disabled={gerandoRecibo === dispositivo.id}
                            >
                              {gerandoRecibo === dispositivo.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <FileText className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </TooltipTrigger>
                        <TooltipContent>
                          {recibosStatus[dispositivo.id].temRecibo 
                            ? "Baixar Recibo Legal" 
                            : "Gerar Recibo Legal"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate('/pdv', { state: { dispositivoSelecionado: dispositivo } })}
                    disabled={dispositivo.quantidade === 0}
                    title="Vender no PDV"
                  >
                    <ShoppingCart className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEditar(dispositivo)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja excluir o dispositivo "{dispositivo.marca} {dispositivo.modelo}"?
                          Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => onExcluir(dispositivo.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
