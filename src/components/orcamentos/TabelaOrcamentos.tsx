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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
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
  Check,
  ArrowRight,
} from "lucide-react";
import { gerarOrcamentoPDF } from "@/lib/gerarOrcamentoPDF";
import { buscarConfiguracaoLojaPorEmpresa } from "@/hooks/useConfiguracaoLoja";
import { Orcamento, StatusOrcamento } from "@/types/orcamento";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useIsMobileOrTablet } from "@/hooks/use-mobile";

interface TabelaOrcamentosProps {
  orcamentos: Orcamento[];
  onVisualizar: (orcamento: Orcamento) => void;
  onEditar: (orcamento: Orcamento) => void;
  onExcluir: (orcamento: Orcamento) => void;
  onAtualizarStatus: (id: string, status: StatusOrcamento) => void;
  onConverterOS: (orcamento: Orcamento) => void;
}

// Cores por status — segue a mesma lógica visual da OS
const statusConfig: Record<
  StatusOrcamento,
  { label: string; cor: string }
> = {
  pendente:   { label: "Pendente",   cor: "#eab308" },
  aprovado:   { label: "Aprovado",   cor: "#22c55e" },
  rejeitado:  { label: "Rejeitado",  cor: "#ef4444" },
  expirado:   { label: "Expirado",   cor: "#6b7280" },
  convertido: { label: "Convertido", cor: "#a855f7" },
};

const opcoesStatus: { value: StatusOrcamento; label: string }[] = [
  { value: "pendente",   label: "Pendente" },
  { value: "aprovado",   label: "Aprovado" },
  { value: "rejeitado",  label: "Rejeitado" },
  { value: "expirado",   label: "Expirado" },
  { value: "convertido", label: "Convertido" },
];

function BadgeStatusCliclavel({
  status,
  expirado,
  id,
  onAtualizarStatus,
}: {
  status: StatusOrcamento;
  expirado: boolean;
  id: string;
  onAtualizarStatus: (id: string, status: StatusOrcamento) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const statusReal: StatusOrcamento = expirado ? "expirado" : status;
  const cfg = statusConfig[statusReal];

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold cursor-pointer transition-all hover:opacity-80 border"
          style={{
            color: cfg.cor,
            borderColor: `${cfg.cor}40`,
            backgroundColor: `${cfg.cor}12`,
          }}
        >
          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: cfg.cor }} />
          {cfg.label}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-0" align="start">
        <Command>
          <CommandGroup>
            {opcoesStatus.map((opcao) => {
              const opcaoCfg = statusConfig[opcao.value];
              return (
                <CommandItem
                  key={opcao.value}
                  value={opcao.value}
                  onSelect={(value) => {
                    onAtualizarStatus(id, value as StatusOrcamento);
                    setAberto(false);
                  }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: opcaoCfg.cor }}
                  />
                  <span className="flex-1 text-xs">{opcao.label}</span>
                  {statusReal === opcao.value && <Check className="h-3.5 w-3.5 shrink-0" />}
                </CommandItem>
              );
            })}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function TabelaOrcamentos({
  orcamentos,
  onVisualizar,
  onEditar,
  onExcluir,
  onAtualizarStatus,
  onConverterOS,
}: TabelaOrcamentosProps) {
  const isMobileOrTablet = useIsMobileOrTablet();

  const handleImprimir = async (orcamento: Orcamento) => {
    const lojaConfig = await buscarConfiguracaoLojaPorEmpresa(orcamento.empresa_id);
    await gerarOrcamentoPDF(orcamento, lojaConfig);
  };

  if (orcamentos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground/50 border rounded-lg">
        <Eye className="h-10 w-10 opacity-20" />
        <p className="text-sm font-medium">Nenhum orçamento encontrado</p>
      </div>
    );
  }

  // Layout mobile: cards
  if (isMobileOrTablet) {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {orcamentos.map((orcamento) => {
          const dataValidade = orcamento.data_validade
            ? new Date(orcamento.data_validade)
            : null;
          const expirado =
            !!dataValidade && dataValidade < new Date() && orcamento.status === "pendente";
          const statusReal: StatusOrcamento = expirado ? "expirado" : orcamento.status;
          const cfg = statusConfig[statusReal];

          return (
            <div
              key={orcamento.id}
              className="relative rounded-xl border bg-card overflow-hidden transition-all duration-150"
              style={{ borderColor: `${cfg.cor}25` }}
            >
              <div className="h-[2px] w-full" style={{ background: `linear-gradient(90deg, ${cfg.cor}90, ${cfg.cor}20)` }} />
              <div className="p-3.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold font-mono text-foreground/75">
                      {orcamento.numero_orcamento}
                    </p>
                    <p className="text-sm font-medium truncate">{orcamento.cliente_nome || "—"}</p>
                  </div>
                  <BadgeStatusCliclavel
                    status={orcamento.status}
                    expirado={expirado}
                    id={orcamento.id}
                    onAtualizarStatus={onAtualizarStatus}
                  />
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border/30">
                  <div className="space-y-0.5">
                    <p className="text-xs font-mono font-bold">{formatCurrency(orcamento.valor_total)}</p>
                    <p className="text-[10px] text-muted-foreground">{orcamento.itens?.length || 0} itens · {formatDate(orcamento.created_at)}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onVisualizar(orcamento)}>
                        <Eye className="h-4 w-4 mr-2" /> Visualizar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleImprimir(orcamento)}>
                        <Printer className="h-4 w-4 mr-2" /> Imprimir PDF
                      </DropdownMenuItem>
                      {orcamento.status === "pendente" && (
                        <>
                          <DropdownMenuItem onClick={() => onEditar(orcamento)}>
                            <Edit className="h-4 w-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onAtualizarStatus(orcamento.id, "aprovado")}>
                            <CheckCircle className="h-4 w-4 mr-2 text-green-600" /> Aprovar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onAtualizarStatus(orcamento.id, "rejeitado")}>
                            <XCircle className="h-4 w-4 mr-2 text-destructive" /> Rejeitar
                          </DropdownMenuItem>
                        </>
                      )}
                      {(orcamento.status === "pendente" || orcamento.status === "aprovado") && (
                        <DropdownMenuItem
                          onClick={() => onConverterOS(orcamento)}
                          className="text-primary font-medium"
                        >
                          <ArrowRight className="h-4 w-4 mr-2" /> Converter em OS
                        </DropdownMenuItem>
                      )}
                      {orcamento.status === "aprovado" && (
                        <DropdownMenuItem onClick={() => onAtualizarStatus(orcamento.id, "convertido")}>
                          <ShoppingCart className="h-4 w-4 mr-2" /> Converter em Venda
                        </DropdownMenuItem>
                      )}
                      {(orcamento.status === "rejeitado" || orcamento.status === "expirado") && (
                        <DropdownMenuItem onClick={() => onAtualizarStatus(orcamento.id, "pendente")}>
                          <RefreshCw className="h-4 w-4 mr-2" /> Reabrir
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => onExcluir(orcamento)} className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Layout desktop: tabela
  return (
    <div className="border rounded-lg overflow-hidden">
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
          {orcamentos.map((orcamento) => {
            const dataValidade = orcamento.data_validade
              ? new Date(orcamento.data_validade)
              : null;
            const expirado =
              !!dataValidade && dataValidade < new Date() && orcamento.status === "pendente";

            return (
              <TableRow key={orcamento.id}>
                <TableCell className="font-medium font-mono">
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
                    <span className={expirado ? "text-destructive text-sm" : "text-sm"}>
                      {formatDate(orcamento.data_validade!)}
                    </span>
                  ) : (
                    "-"
                  )}
                </TableCell>
                {/* Status clicável */}
                <TableCell>
                  <BadgeStatusCliclavel
                    status={orcamento.status}
                    expirado={expirado}
                    id={orcamento.id}
                    onAtualizarStatus={onAtualizarStatus}
                  />
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
                        <Eye className="h-4 w-4 mr-2" /> Visualizar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleImprimir(orcamento)}>
                        <Printer className="h-4 w-4 mr-2" /> Imprimir PDF
                      </DropdownMenuItem>
                      {orcamento.status === "pendente" && (
                        <>
                          <DropdownMenuItem onClick={() => onEditar(orcamento)}>
                            <Edit className="h-4 w-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onAtualizarStatus(orcamento.id, "aprovado")}
                          >
                            <CheckCircle className="h-4 w-4 mr-2 text-green-600" /> Aprovar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onAtualizarStatus(orcamento.id, "rejeitado")}
                          >
                            <XCircle className="h-4 w-4 mr-2 text-destructive" /> Rejeitar
                          </DropdownMenuItem>
                        </>
                      )}
                      {(orcamento.status === "pendente" || orcamento.status === "aprovado") && (
                        <DropdownMenuItem
                          onClick={() => onConverterOS(orcamento)}
                          className="text-primary font-medium"
                        >
                          <ArrowRight className="h-4 w-4 mr-2" /> Converter em OS
                        </DropdownMenuItem>
                      )}
                      {orcamento.status === "aprovado" && (
                        <DropdownMenuItem
                          onClick={() => onAtualizarStatus(orcamento.id, "convertido")}
                        >
                          <ShoppingCart className="h-4 w-4 mr-2" /> Converter em Venda
                        </DropdownMenuItem>
                      )}
                      {(orcamento.status === "rejeitado" || orcamento.status === "expirado") && (
                        <DropdownMenuItem
                          onClick={() => onAtualizarStatus(orcamento.id, "pendente")}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" /> Reabrir
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => onExcluir(orcamento)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
