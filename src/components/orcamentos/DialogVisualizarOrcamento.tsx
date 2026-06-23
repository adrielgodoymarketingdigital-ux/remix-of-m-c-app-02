import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Orcamento, StatusOrcamento } from "@/types/orcamento";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import {
  Calendar,
  User,
  Phone,
  Mail,
  FileText,
  Printer,
  ArrowRightLeft,
  Wrench,
  ShoppingCart,
  Settings,
  ChevronDown,
  Thermometer,
} from "lucide-react";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { ImpressaoOrcamento } from "./ImpressaoOrcamento";
import { DialogConfiguracaoLayoutOrcamento } from "./DialogConfiguracaoLayoutOrcamento";

interface DialogVisualizarOrcamentoProps {
  aberto: boolean;
  onFechar: () => void;
  orcamento: Orcamento | null;
  onConverter?: (orcamento: Orcamento, tipo: "os" | "venda") => void;
}

const statusConfig: Record<
  StatusOrcamento,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  pendente: { label: "Pendente", variant: "secondary" },
  aprovado: { label: "Aprovado", variant: "default" },
  rejeitado: { label: "Rejeitado", variant: "destructive" },
  expirado: { label: "Expirado", variant: "outline" },
  convertido: { label: "Convertido", variant: "default" },
};

export function DialogVisualizarOrcamento({
  aberto,
  onFechar,
  orcamento,
  onConverter,
}: DialogVisualizarOrcamentoProps) {
  const { config: lojaConfig } = useConfiguracaoLoja();
  const [imprimindo, setImprimindo] = useState(false);
  const [configImpressao, setConfigImpressao] = useState<typeof lojaConfig | null>(null);
  const [configLayoutAberto, setConfigLayoutAberto] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  if (!orcamento) return null;

  const config = statusConfig[orcamento.status];

  const temServicos = orcamento.itens?.some((i) => i.tipo === "servico");
  const temProdutosOuDispositivos = orcamento.itens?.some(
    (i) => i.tipo === "produto" || i.tipo === "dispositivo"
  );

  const handleImprimirA4 = () => {
    setConfigImpressao({
      ...lojaConfig,
      layout_orcamento_config: {
        ...(lojaConfig?.layout_orcamento_config ?? {}),
        formato_papel: "a4" as const,
      },
    });
    setImprimindo(true);
  };

  const handleImprimirTermica = () => {
    setConfigImpressao({
      ...lojaConfig,
      layout_orcamento_config: {
        ...(lojaConfig?.layout_orcamento_config ?? {}),
        formato_papel: "80mm" as const,
      },
    });
    setImprimindo(true);
  };

  const handleFecharImpressao = () => {
    setImprimindo(false);
    setConfigImpressao(null);
  };

  const handleConverterOS = () => {
    if (onConverter) {
      onConverter(orcamento, "os");
    } else {
      navigate("/os", { state: { orcamentoParaConverter: orcamento } });
      toast({
        title: "Convertendo orçamento",
        description: "Crie uma nova OS com os dados do orçamento.",
      });
    }
    onFechar();
  };

  const handleConverterVenda = () => {
    if (onConverter) {
      onConverter(orcamento, "venda");
    } else {
      navigate("/pdv", { state: { orcamentoParaConverter: orcamento } });
      toast({
        title: "Convertendo orçamento",
        description: "Realize a venda com os dados do orçamento.",
      });
    }
    onFechar();
  };


  return (
    <>
      <Dialog open={aberto} onOpenChange={onFechar}>
        <DialogContent className="max-w-2xl sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {orcamento.numero_orcamento}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Badge variant={config.variant}>{config.label}</Badge>

                {/* Settings button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setConfigLayoutAberto(true)}
                  title="Configurar layout de impressão"
                >
                  <Settings className="h-4 w-4" />
                </Button>

                {/* Print dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={imprimindo}
                    >
                      <Printer className="h-4 w-4 mr-1" />
                      {imprimindo ? "Imprimindo..." : "Imprimir"}
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleImprimirA4}>
                      <Printer className="h-4 w-4 mr-2" />
                      Imprimir A4
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleImprimirTermica}>
                      <Thermometer className="h-4 w-4 mr-2" />
                      Impressora Térmica (80mm)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            {/* Botão de Conversão */}
            {orcamento.status !== "convertido" &&
              orcamento.status !== "rejeitado" && (
                <div className="flex gap-2">
                  {temServicos && (
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={handleConverterOS}
                    >
                      <Wrench className="h-4 w-4 mr-2" />
                      Converter em OS
                    </Button>
                  )}
                  {temProdutosOuDispositivos && (
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={handleConverterVenda}
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Converter em Venda
                    </Button>
                  )}
                  {!temServicos && !temProdutosOuDispositivos && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full">
                          <ArrowRightLeft className="h-4 w-4 mr-2" />
                          Converter Orçamento
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={handleConverterOS}>
                          <Wrench className="h-4 w-4 mr-2" />
                          Converter em Ordem de Serviço
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleConverterVenda}>
                          <ShoppingCart className="h-4 w-4 mr-2" />
                          Converter em Venda
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              )}

            {/* Informações do Cliente */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Cliente</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{orcamento.cliente_nome || "Não informado"}</span>
                </div>
                {orcamento.cliente_telefone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{orcamento.cliente_telefone}</span>
                  </div>
                )}
                {orcamento.cliente_email && (
                  <div className="flex items-center gap-2 md:col-span-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{orcamento.cliente_email}</span>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Itens */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Itens</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3 text-sm font-medium">
                        Descrição
                      </th>
                      <th className="text-center p-3 text-sm font-medium">
                        Qtd
                      </th>
                      <th className="text-right p-3 text-sm font-medium">
                        Valor Unit.
                      </th>
                      <th className="text-right p-3 text-sm font-medium">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {orcamento.itens?.map((item, index) => (
                      <tr key={item.id || index} className="border-t">
                        <td className="p-3">
                          <div>
                            <p>{item.descricao}</p>
                            <Badge variant="outline" className="text-xs mt-1">
                              {item.tipo}
                            </Badge>
                          </div>
                        </td>
                        <td className="p-3 text-center">{item.quantidade}</td>
                        <td className="p-3 text-right">
                          <ValorMonetario valor={item.valor_unitario} />
                        </td>
                        <td className="p-3 text-right font-medium">
                          <ValorMonetario valor={item.valor_total} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <Separator />

            {/* Totais */}
            <div className="space-y-2 p-4 bg-muted rounded-lg">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>
                  <ValorMonetario valor={orcamento.subtotal} />
                </span>
              </div>
              {orcamento.desconto > 0 && (
                <div className="flex justify-between text-destructive">
                  <span>Desconto</span>
                  <span>
                    - <ValorMonetario valor={orcamento.desconto} />
                  </span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>
                  <ValorMonetario valor={orcamento.valor_total} />
                </span>
              </div>
            </div>

            {/* Datas */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Criado em: {formatDate(orcamento.created_at)}</span>
              </div>
              {orcamento.data_validade && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Validade: {formatDate(orcamento.data_validade)}</span>
                </div>
              )}
            </div>

            {/* Observações */}
            {orcamento.observacoes && (
              <div className="space-y-2">
                <h4 className="font-medium">Observações</h4>
                <p className="text-muted-foreground text-sm p-3 bg-muted rounded-lg">
                  {orcamento.observacoes}
                </p>
              </div>
            )}

            {/* Termos */}
            {orcamento.termos_condicoes && (
              <div className="space-y-2">
                <h4 className="font-medium">Termos e Condições</h4>
                <p className="text-muted-foreground text-sm p-3 bg-muted rounded-lg">
                  {orcamento.termos_condicoes}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Componente de impressão — renderizado fora do dialog */}
      {imprimindo && configImpressao && (
        <ImpressaoOrcamento
          orcamento={orcamento}
          configuracaoLoja={configImpressao ?? undefined}
          onFecharImpressao={handleFecharImpressao}
        />
      )}

      {/* Dialog de configuração de layout */}
      <DialogConfiguracaoLayoutOrcamento
        open={configLayoutAberto}
        onOpenChange={setConfigLayoutAberto}
      />
    </>
  );
}
