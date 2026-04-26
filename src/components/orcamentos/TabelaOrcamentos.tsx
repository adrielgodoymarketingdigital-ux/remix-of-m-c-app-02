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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Eye,
  Edit,
  Trash2,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  RefreshCw,
  ShoppingCart,
  Printer,
} from "lucide-react";
import { gerarOrcamentoPDF } from "@/lib/gerarOrcamentoPDF";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { Orcamento, StatusOrcamento } from "@/types/orcamento";
import { formatCurrency, formatDate } from "@/lib/formatters";

interface TabelaOrcamentosProps {
  orcamentos: Orcamento[];
  onVisualizar: (orcamento: Orcamento) => void;
  onEditar: (orcamento: Orcamento) => void;
  onExcluir: (orcamento: Orcamento) => void;
  onAtualizarStatus: (id: string, status: StatusOrcamento) => void;
}

const statusConfig: Record<StatusOrcamento, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pendente: { label: "Pendente", variant: "secondary" },
  aprovado: { label: "Aprovado", variant: "default" },
  rejeitado: { label: "Rejeitado", variant: "destructive" },
  expirado: { label: "Expirado", variant: "outline" },
  convertido: { label: "Convertido", variant: "default" },
};

export function TabelaOrcamentos({
  orcamentos,
  onVisualizar,
  onEditar,
  onExcluir,
  onAtualizarStatus,
}: TabelaOrcamentosProps) {
  const { config: lojaConfig } = useConfiguracaoLoja();

  const handleImprimir = async (orcamento: Orcamento) => {
    await gerarOrcamentoPDF(orcamento, lojaConfig);
  };

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Número</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Itens</TableHead>
            <TableHead>Valor Total</TableHead>
            <TableHead>Validade</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Data</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orcamentos.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                Nenhum orçamento encontrado
              </TableCell>
            </TableRow>
          ) : (
            orcamentos.map((orcamento) => {
              const config = statusConfig[orcamento.status];
              const dataValidade = orcamento.data_validade
                ? new Date(orcamento.data_validade)
                : null;
              const expirado =
                dataValidade && dataValidade < new Date() && orcamento.status === "pendente";

              return (
                <TableRow key={orcamento.id}>
                  <TableCell className="font-medium">
                    {orcamento.numero_orcamento}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{orcamento.cliente_nome || "-"}</p>
                      {orcamento.cliente_telefone && (
                        <p className="text-sm text-muted-foreground">
                          {orcamento.cliente_telefone}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{orcamento.itens?.length || 0} itens</TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(orcamento.valor_total)}
                  </TableCell>
                  <TableCell>
                    {dataValidade ? (
                      <span className={expirado ? "text-destructive" : ""}>
                        {formatDate(orcamento.data_validade!)}
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={expirado ? "destructive" : config.variant}>
                      {expirado ? "Expirado" : config.label}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(orcamento.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onVisualizar(orcamento)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Visualizar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleImprimir(orcamento)}>
                          <Printer className="h-4 w-4 mr-2" />
                          Imprimir PDF
                        </DropdownMenuItem>
                        {orcamento.status === "pendente" && (
                          <>
                            <DropdownMenuItem onClick={() => onEditar(orcamento)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onAtualizarStatus(orcamento.id, "aprovado")}
                            >
                              <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                              Aprovar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onAtualizarStatus(orcamento.id, "rejeitado")}
                            >
                              <XCircle className="h-4 w-4 mr-2 text-destructive" />
                              Rejeitar
                            </DropdownMenuItem>
                          </>
                        )}
                        {orcamento.status === "aprovado" && (
                          <DropdownMenuItem
                            onClick={() => onAtualizarStatus(orcamento.id, "convertido")}
                          >
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            Converter em Venda
                          </DropdownMenuItem>
                        )}
                        {(orcamento.status === "rejeitado" ||
                          orcamento.status === "expirado") && (
                          <DropdownMenuItem
                            onClick={() => onAtualizarStatus(orcamento.id, "pendente")}
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Reabrir
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => onExcluir(orcamento)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
