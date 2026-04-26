import { Search, CalendarIcon, X } from "lucide-react";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useOSStatusConfig } from "@/hooks/useOSStatusConfig";

interface BuscaOrdemServicoProps {
  busca: string;
  onBuscaChange: (value: string) => void;
  statusFiltro: string;
  onStatusFiltroChange: (value: string) => void;
  dataInicio?: Date;
  onDataInicioChange: (value: Date | undefined) => void;
  dataFim?: Date;
  onDataFimChange: (value: Date | undefined) => void;
  mesFiltro: string;
  onMesFiltroChange: (value: string) => void;
}

const gerarOpcoesMeses = () => {
  const opcoes = [];
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  
  // Adicionar todos os meses de 2026 (futuros primeiro, se aplicável)
  for (let mes = 11; mes >= 0; mes--) {
    const data2026 = new Date(2026, mes, 1);
    // Só adicionar meses de 2026 que ainda não passaram ou são o mês atual
    if (data2026 >= hoje || (data2026.getFullYear() === hoje.getFullYear() && data2026.getMonth() <= hoje.getMonth())) {
      continue; // Será adicionado no loop principal
    }
    if (data2026 > hoje) {
      const valor = format(data2026, "yyyy-MM");
      const label = format(data2026, "MMMM yyyy", { locale: ptBR });
      const labelCapitalized = label.charAt(0).toUpperCase() + label.slice(1);
      opcoes.push({ value: valor, label: labelCapitalized });
    }
  }
  
  // Adicionar meses futuros de 2026 (do atual até dezembro)
  if (anoAtual === 2026) {
    for (let mes = 11; mes > hoje.getMonth(); mes--) {
      const dataFutura = new Date(2026, mes, 1);
      const valor = format(dataFutura, "yyyy-MM");
      const label = format(dataFutura, "MMMM yyyy", { locale: ptBR });
      const labelCapitalized = label.charAt(0).toUpperCase() + label.slice(1);
      opcoes.push({ value: valor, label: labelCapitalized });
    }
  }
  
  // Adicionar últimos 12 meses (incluindo o atual)
  for (let i = 0; i < 12; i++) {
    const data = subMonths(hoje, i);
    const valor = format(data, "yyyy-MM");
    const label = format(data, "MMMM yyyy", { locale: ptBR });
    const labelCapitalized = label.charAt(0).toUpperCase() + label.slice(1);
    opcoes.push({ value: valor, label: labelCapitalized });
  }
  
  return opcoes;
};

export const BuscaOrdemServico = ({ 
  busca, 
  onBuscaChange,
  statusFiltro,
  onStatusFiltroChange,
  dataInicio,
  onDataInicioChange,
  dataFim,
  onDataFimChange,
  mesFiltro,
  onMesFiltroChange
}: BuscaOrdemServicoProps) => {
  const opcoesMeses = gerarOpcoesMeses();
  const { statusList } = useOSStatusConfig();
  
  const limparFiltros = () => {
    onDataInicioChange(undefined);
    onDataFimChange(undefined);
    onMesFiltroChange("todos");
  };

  const temFiltro = dataInicio || dataFim || mesFiltro !== "todos";

  return (
    <div className="flex flex-col gap-4">
      {/* Linha 1: Campo de busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, IMEI, modelo ou número da OS..."
          value={busca}
          onChange={(e) => onBuscaChange(e.target.value)}
          className="pl-10"
        />
      </div>
      
      {/* Linha 2: Filtros de data e status */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        {/* Filtro por Mês */}
        <div className="w-full sm:w-[180px]">
          <Select value={mesFiltro} onValueChange={onMesFiltroChange}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por mês" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Meses</SelectItem>
              {opcoesMeses.map((opcao) => (
                <SelectItem key={opcao.value} value={opcao.value}>
                  {opcao.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Data Inicial */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full sm:w-[150px] justify-start text-left font-normal",
                !dataInicio && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dataInicio ? format(dataInicio, "dd/MM/yyyy") : "Data inicial"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dataInicio}
              onSelect={onDataInicioChange}
              locale={ptBR}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        {/* Data Final */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full sm:w-[150px] justify-start text-left font-normal",
                !dataFim && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dataFim ? format(dataFim, "dd/MM/yyyy") : "Data final"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dataFim}
              onSelect={onDataFimChange}
              locale={ptBR}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        {/* Status */}
        <div className="w-full sm:w-[200px]">
          <Select value={statusFiltro} onValueChange={onStatusFiltroChange}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Status</SelectItem>
              {statusList.filter(s => s.ativo).map((status) => (
                <SelectItem key={status.slug} value={status.slug}>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: status.cor }} />
                    {status.nome}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Botão Limpar Filtros */}
        {temFiltro && (
          <Button
            variant="ghost"
            size="icon"
            onClick={limparFiltros}
            className="shrink-0"
            title="Limpar filtros"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
