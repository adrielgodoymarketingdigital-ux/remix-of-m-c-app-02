import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { ShoppingCart, Pencil, Trash2, ImageIcon, FileText, Download, Loader2, Lock } from "lucide-react";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { Dispositivo } from "@/types/dispositivo";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { gerarReciboLegalPDF, salvarReciboStorage } from "@/lib/gerarReciboLegalPDF";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { useNavigate } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CardDispositivoProps {
  dispositivo: Dispositivo;
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

export function CardDispositivo({
  dispositivo,
  onEditar,
  onExcluir,
}: CardDispositivoProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { podeVerCustos, podeVerLucros } = useFuncionarioPermissoes();
  const [temRecibo, setTemRecibo] = useState(false);
  const [compraId, setCompraId] = useState<string | null>(null);
  const [gerandoRecibo, setGerandoRecibo] = useState(false);
  const { config, loading: loadingConfig, validarParaRecibos } = useConfiguracaoLoja();

  useEffect(() => {
    const verificarRecibo = async () => {
      if (dispositivo.origem_tipo === 'terceiro') {
        const { data, error } = await supabase
          .from('compras_dispositivos')
          .select('id, termo_pdf_url')
          .eq('dispositivo_id', dispositivo.id)
          .maybeSingle();
        
        if (!error && data) {
          setCompraId(data.id);
          setTemRecibo(!!data.termo_pdf_url);
        }
      }
    };

    verificarRecibo();
  }, [dispositivo.id, dispositivo.origem_tipo]);

  const handleGerarReciboLegal = async () => {
    if (!compraId) {
      toast({
        title: "Erro",
        description: "Compra não encontrada para este dispositivo",
        variant: "destructive",
      });
      return;
    }

    setGerandoRecibo(true);
    try {
      // Validar configuração da loja
      if (loadingConfig) {
        toast({
          title: "Aguarde",
          description: "Carregando configurações da loja...",
        });
        setGerandoRecibo(false);
        return;
      }

      const validacao = validarParaRecibos();
      if (!validacao.valido) {
        toast({
          title: "Dados da loja incompletos",
          description: `Complete os seguintes campos: ${validacao.camposFaltando.join(", ")}. Acesse Configurações para preencher.`,
          variant: "destructive",
        });
        setGerandoRecibo(false);
        return;
      }

      // Buscar dados da compra
      const { data: compra, error: compraError } = await supabase
        .from("compras_dispositivos")
        .select("*, origem_pessoas(*)")
        .eq("id", compraId)
        .single();

      if (compraError || !compra) {
        toast({
          title: "Erro",
          description: "Não foi possível encontrar os dados da compra",
          variant: "destructive",
        });
        setGerandoRecibo(false);
        return;
      }

      // Validar vendedor
      if (!compra.origem_pessoas?.nome || !compra.origem_pessoas?.cpf_cnpj) {
        toast({
          title: "Dados do vendedor incompletos",
          description: "Por favor, complete os dados do vendedor (Nome e CPF/CNPJ)",
          variant: "destructive",
        });
        setGerandoRecibo(false);
        return;
      }

      // Gerar PDF
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

      // Salvar no storage
      const pdfUrl = await salvarReciboStorage(pdf, compraId);

      if (!pdfUrl) {
        throw new Error("Erro ao salvar PDF no storage");
      }

      // Atualizar registro da compra
      const { error: updateError } = await supabase
        .from("compras_dispositivos")
        .update({ termo_pdf_url: pdfUrl })
        .eq("id", compraId);

      if (updateError) {
        throw updateError;
      }

      setTemRecibo(true);

      toast({
        title: "Sucesso!",
        description: "Recibo legal gerado com sucesso",
      });

      // Abrir PDF em nova aba
      window.open(pdfUrl, "_blank");
    } catch (error) {
      console.error("Erro ao gerar recibo:", error);
      toast({
        title: "Erro ao gerar recibo",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setGerandoRecibo(false);
    }
  };

  const handleVender = () => {
    navigate('/pdv', { 
      state: { 
        dispositivoSelecionado: dispositivo 
      } 
    });
  };

  const handleBaixarRecibo = async () => {
    if (!compraId) return;

    try {
      const { data } = await supabase
        .from("compras_dispositivos")
        .select("termo_pdf_url")
        .eq("id", compraId)
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

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="relative h-40 bg-muted flex items-center justify-center p-2">
        {(dispositivo.fotos && dispositivo.fotos.length > 0) || dispositivo.foto_url ? (
          <>
            <img
              src={dispositivo.fotos?.[0] || dispositivo.foto_url || ''}
              alt={`${dispositivo.marca} ${dispositivo.modelo}`}
              className="max-w-full max-h-full object-contain"
            />
            {dispositivo.fotos && dispositivo.fotos.length > 1 && (
              <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                <ImageIcon className="h-3 w-3" />
                <span>{dispositivo.fotos.length}</span>
              </div>
            )}
          </>
        ) : (
          <ImageIcon className="h-16 w-16 text-muted-foreground" />
        )}
        
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          <Badge className={`${getTipoBadgeColor(dispositivo.tipo)} text-white`}>
            {dispositivo.tipo}
          </Badge>
          <Badge variant={
            dispositivo.condicao === 'novo' ? 'default' :
            dispositivo.condicao === 'semi_novo' ? 'secondary' :
            'outline'
          }>
            {dispositivo.condicao === 'novo' ? 'Novo' :
             dispositivo.condicao === 'semi_novo' ? 'Semi Novo' :
             'Usado'}
          </Badge>
          <Badge variant={dispositivo.quantidade > 0 ? "secondary" : "destructive"}>
            Qtd: {dispositivo.quantidade}
          </Badge>
          {dispositivo.origem_tipo === 'terceiro' && (
            <Badge variant={temRecibo ? "default" : "secondary"}>
              {temRecibo ? "✓ Recibo" : "Sem Recibo"}
            </Badge>
          )}
        </div>

        {dispositivo.garantia && (
          <Badge className="absolute top-2 right-2 bg-green-600">
            Garantia {dispositivo.tempo_garantia}m
          </Badge>
        )}
      </div>

      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="font-bold text-lg">{dispositivo.marca}</h3>
          <p className="text-sm text-muted-foreground">{dispositivo.modelo}</p>
          {dispositivo.subtipo_computador && (
            <p className="text-xs text-muted-foreground">
              {dispositivo.subtipo_computador}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          {dispositivo.capacidade_gb && (
            <div>
              <span className="text-muted-foreground">Capacidade:</span>
              <p className="font-medium">{dispositivo.capacidade_gb} GB</p>
            </div>
          )}
          {dispositivo.imei && (
            <div>
              <span className="text-muted-foreground">IMEI:</span>
              <p className="font-medium text-xs">{dispositivo.imei}</p>
            </div>
          )}
        </div>

        <div className="border-t pt-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Custo:</span>
            <span>
              {podeVerCustos
                ? (dispositivo.custo ? <ValorMonetario valor={dispositivo.custo} /> : "-")
                : <Lock className="inline h-3 w-3 text-muted-foreground" />
              }
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Preço:</span>
            <span className="font-medium">
              {dispositivo.preco ? <ValorMonetario valor={dispositivo.preco} tipo="preco" /> : "-"}
            </span>
          </div>
          <div className="flex justify-between text-sm font-bold">
            <span>Lucro:</span>
            <span className={
              dispositivo.lucro && dispositivo.lucro >= 0 ? "text-green-600" : "text-red-600"
            }>
              {podeVerLucros
                ? (dispositivo.lucro !== undefined && dispositivo.lucro !== null
                    ? <ValorMonetario valor={dispositivo.lucro} />
                    : "-")
                : <Lock className="inline h-3 w-3 text-muted-foreground" />
              }
            </span>
          </div>
        </div>

        {/* Origem Badge */}
        {(dispositivo as any).origem_tipo && (
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center justify-between">
              <Badge variant={
                (dispositivo as any).origem_tipo === 'terceiro' ? 'default' :
                (dispositivo as any).origem_tipo === 'fornecedor' ? 'secondary' :
                'outline'
              }>
                {(dispositivo as any).origem_tipo === 'terceiro' && '👤 Terceiro'}
                {(dispositivo as any).origem_tipo === 'fornecedor' && '🏢 Fornecedor'}
                {(dispositivo as any).origem_tipo === 'estoque_proprio' && '📦 Estoque'}
              </Badge>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleVender}
            className="flex-1"
            size="sm"
            disabled={dispositivo.quantidade === 0}
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            Vender
          </Button>

          {dispositivo.origem_tipo === 'terceiro' && compraId && (
            temRecibo ? (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleBaixarRecibo}
                disabled={gerandoRecibo}
              >
                <Download className="h-4 w-4 mr-2" />
                Ver Recibo Legal
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={handleGerarReciboLegal}
                disabled={gerandoRecibo}
              >
                {gerandoRecibo ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Gerar Recibo Legal
              </Button>
            )
          )}

          <Button
            onClick={() => onEditar(dispositivo)}
            variant="default"
            size="sm"
            className="flex-1"
          >
            <Pencil className="h-4 w-4 mr-2" />
            Editar
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="flex-1">
                <Trash2 className="h-3 w-3 mr-1" />
                Excluir
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir "{dispositivo.marca} {dispositivo.modelo}"?
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
      </CardContent>
    </Card>
  );
}
