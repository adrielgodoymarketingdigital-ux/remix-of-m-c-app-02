import { CalendarIcon, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Barra de mês e Filtros da aba Desempenho no computador (>= 1024px), no mesmo
 * lugar de antes. Só apresentação: o mês e o filtro de cargo continuam no
 * DashboardEquipe.
 */

interface BarraMesDesempenhoDesktopProps {
  mesLabel: string;
  isAtual: boolean;
  onMesAnterior: () => void;
  onProximoMes: () => void;
  onMesAtual: () => void;
  filtroCargo: string;
  onFiltroCargoChange: (valor: string) => void;
  cargosDisponiveis: string[];
}

export function BarraMesDesempenhoDesktop({
  mesLabel,
  isAtual,
  onMesAnterior,
  onProximoMes,
  onMesAtual,
  filtroCargo,
  onFiltroCargoChange,
  cargosDisponiveis,
}: BarraMesDesempenhoDesktopProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-lg shadow-sm"
          onClick={onMesAnterior}
          aria-label="Mês anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex h-10 min-w-[200px] items-center justify-center gap-2 rounded-lg border bg-card px-4 shadow-sm">
          <CalendarIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="whitespace-nowrap font-semibold capitalize">{mesLabel}</span>
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-lg shadow-sm"
          disabled={isAtual}
          onClick={onProximoMes}
          aria-label="Próximo mês"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        {!isAtual && (
          <Button variant="ghost" size="sm" className="h-10" onClick={onMesAtual}>
            Mês atual
          </Button>
        )}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-10 gap-2 rounded-lg shadow-sm">
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 space-y-2">
          <p className="text-sm font-medium">Cargo</p>
          <Select value={filtroCargo} onValueChange={onFiltroCargoChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {cargosDisponiveis.map((cargo) => (
                <SelectItem key={cargo} value={cargo}>{cargo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PopoverContent>
      </Popover>
    </div>
  );
}
