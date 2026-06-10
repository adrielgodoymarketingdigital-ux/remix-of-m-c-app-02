import { useState, useMemo } from "react";
import { Download, FileText, Table2, CheckSquare, Filter } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { OrdemServico } from "@/hooks/useOrdensServico";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useOSStatusConfigContext as useOSStatusConfig } from "@/contexts/OSStatusConfigContext";

interface DialogExportarRelatorioProps {
  aberto: boolean;
  onFechar: () => void;
  ordens: OrdemServico[];
  itensSelecionados?: Set<string>;
}

const COLUNAS_DISPONIVEIS = [
  { id: "numero_os", label: "Nº OS" },
  { id: "created_at", label: "Data de Entrada" },
  { id: "data_saida", label: "Data de Saída" },
  { id: "cliente", label: "Cliente" },
  { id: "telefone", label: "Telefone" },
  { id: "dispositivo", label: "Dispositivo" },
  { id: "imei", label: "IMEI / Série" },
  { id: "defeito_relatado", label: "Defeito Relatado" },
  { id: "status", label: "Status" },
  { id: "total", label: "Valor Total" },
  { id: "localizacao_fisica", label: "Localização Física" },
];

const COLUNAS_PADRAO = ["numero_os", "created_at", "cliente", "dispositivo", "defeito_relatado", "status", "total"];

type ModoExport = "selecionadas" | "status" | "todas";

function gerarCSV(linhas: string[][]): string {
  return linhas
    .map((row) =>
      row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";")
    )
    .join("\n");
}

function baixarArquivo(conteudo: string, nomeArquivo: string, tipo: string) {
  const bom = "﻿";
  const blob = new Blob([bom + conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}

function resolverValorColuna(ordem: OrdemServico, colId: string, statusLabel: string): string {
  switch (colId) {
    case "numero_os":
      return ordem.numero_os || "";
    case "created_at":
      return ordem.created_at
        ? format(new Date(ordem.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
        : "";
    case "data_saida":
      return ordem.data_saida
        ? format(new Date(ordem.data_saida), "dd/MM/yyyy", { locale: ptBR })
        : "";
    case "cliente":
      return ordem.cliente?.nome || "";
    case "telefone":
      return ordem.cliente?.telefone || "";
    case "dispositivo":
      return [ordem.dispositivo_marca, ordem.dispositivo_modelo].filter(Boolean).join(" ") || "";
    case "imei":
      return ordem.dispositivo_imei || ordem.dispositivo_numero_serie || "";
    case "defeito_relatado":
      return ordem.defeito_relatado || "";
    case "status":
      return statusLabel;
    case "total":
      return ordem.total != null ? String(ordem.total).replace(".", ",") : "";
    case "localizacao_fisica":
      return (ordem as any).localizacao_fisica || "";
    default:
      return "";
  }
}

export function DialogExportarRelatorio({
  aberto,
  onFechar,
  ordens,
  itensSelecionados,
}: DialogExportarRelatorioProps) {
  const { statusList, getStatusBySlug } = useOSStatusConfig();

  const [modo, setModo] = useState<ModoExport>(
    itensSelecionados && itensSelecionados.size > 0 ? "selecionadas" : "todas"
  );
  const [statusFiltroExport, setStatusFiltroExport] = useState<string>("todos");
  const [colunasSelecionadas, setColunasSelecionadas] = useState<Set<string>>(
    new Set(COLUNAS_PADRAO)
  );

  const toggleColuna = (id: string) => {
    setColunasSelecionadas((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) {
        if (novo.size === 1) return prev; // mínimo 1 coluna
        novo.delete(id);
      } else {
        novo.add(id);
      }
      return novo;
    });
  };

  const ordensParaExportar = useMemo(() => {
    let resultado = ordens.filter((o) => !(o.avarias as any)?.is_avulso);
    if (modo === "selecionadas" && itensSelecionados && itensSelecionados.size > 0) {
      resultado = resultado.filter((o) => itensSelecionados.has(o.id));
    } else if (modo === "status" && statusFiltroExport !== "todos") {
      resultado = resultado.filter((o) => o.status === statusFiltroExport);
    }
    return resultado;
  }, [ordens, modo, itensSelecionados, statusFiltroExport]);

  const colunasOrdenadas = COLUNAS_DISPONIVEIS.filter((c) => colunasSelecionadas.has(c.id));

  const handleExportar = () => {
    const cabecalho = colunasOrdenadas.map((c) => c.label);
    const linhas = ordensParaExportar.map((ordem) => {
      const statusConfig = getStatusBySlug(ordem.status || "");
      const statusLabel = statusConfig?.nome || ordem.status || "";
      return colunasOrdenadas.map((c) => resolverValorColuna(ordem, c.id, statusLabel));
    });

    const dataHoje = format(new Date(), "yyyy-MM-dd");
    const nomeArquivo = `relatorio-os-${dataHoje}.csv`;
    const csv = gerarCSV([cabecalho, ...linhas]);
    baixarArquivo(csv, nomeArquivo, "text/csv;charset=utf-8;");
    onFechar();
  };

  const temSelecionadas = itensSelecionados && itensSelecionados.size > 0;

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Download className="h-4 w-4" />
            Exportar Relatório de OS
          </DialogTitle>
          <DialogDescription className="text-xs">
            Gera um arquivo CSV com os dados das OS selecionadas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Modo de exportação */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              O que exportar
            </Label>
            <div className="grid grid-cols-1 gap-2">
              {temSelecionadas && (
                <button
                  type="button"
                  onClick={() => setModo("selecionadas")}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                    modo === "selecionadas"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-muted/20 hover:bg-muted/40"
                  }`}
                >
                  <CheckSquare className="h-4 w-4 shrink-0" />
                  <span className="flex-1">OS selecionadas</span>
                  <Badge variant="secondary" className="text-xs">
                    {itensSelecionados!.size}
                  </Badge>
                </button>
              )}

              <button
                type="button"
                onClick={() => setModo("status")}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                  modo === "status"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-muted/20 hover:bg-muted/40"
                }`}
              >
                <Filter className="h-4 w-4 shrink-0" />
                <span className="flex-1">Filtrar por status</span>
              </button>

              <button
                type="button"
                onClick={() => setModo("todas")}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                  modo === "todas"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-muted/20 hover:bg-muted/40"
                }`}
              >
                <Table2 className="h-4 w-4 shrink-0" />
                <span className="flex-1">Todas as OS do período</span>
                <Badge variant="secondary" className="text-xs">
                  {ordens.filter((o) => !(o.avarias as any)?.is_avulso).length}
                </Badge>
              </button>
            </div>
          </div>

          {/* Filtro por status */}
          {modo === "status" && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Status
              </Label>
              <Select value={statusFiltroExport} onValueChange={setStatusFiltroExport}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  {statusList.map((s) => (
                    <SelectItem key={s.slug} value={s.slug}>
                      {s.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {statusFiltroExport !== "todos" && (
                <p className="text-xs text-muted-foreground">
                  {ordensParaExportar.length} OS com este status no período atual
                </p>
              )}
            </div>
          )}

          {/* Colunas */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Colunas do relatório
            </Label>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {COLUNAS_DISPONIVEIS.map((col) => (
                <div key={col.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`col-${col.id}`}
                    checked={colunasSelecionadas.has(col.id)}
                    onCheckedChange={() => toggleColuna(col.id)}
                    className="h-3.5 w-3.5"
                  />
                  <label
                    htmlFor={`col-${col.id}`}
                    className="text-xs cursor-pointer select-none leading-none"
                  >
                    {col.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Resumo + botão */}
          <div className="flex items-center justify-between pt-1 border-t border-border/40">
            <span className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{ordensParaExportar.length}</span>{" "}
              {ordensParaExportar.length === 1 ? "OS será exportada" : "OS serão exportadas"}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={onFechar} className="h-8 text-xs">
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleExportar}
                disabled={ordensParaExportar.length === 0}
                className="h-8 text-xs gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                Exportar CSV
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
