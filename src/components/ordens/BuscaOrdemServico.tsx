import { Search, CalendarIcon, X, Building2, Package, SlidersHorizontal, RotateCcw } from "lucide-react";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useOSStatusConfigContext as useOSStatusConfig } from "@/contexts/OSStatusConfigContext";

interface BuscaOrdemServicoProps {
  busca: string;
  onBuscaChange: (value: string) => void;
  statusFiltro: string;
  onStatusFiltroChange: (value: string) => void;
  origemFiltro: string;
  onOrigemFiltroChange: (value: string) => void;
  midiaFiltro: string;
  onMidiaFiltroChange: (value: string) => void;
  dataInicio?: Date;
  onDataInicioChange: (value: Date | undefined) => void;
  dataFim?: Date;
  onDataFimChange: (value: Date | undefined) => void;
  mesFiltro: string;
  onMesFiltroChange: (value: string) => void;
  lojaFiltro?: string;
  onLojaFiltroChange?: (value: string) => void;
  empresasDisponiveis?: { id: string; nome: string }[];
  somenteRemessaCorporativa: boolean;
  onSomenteRemessaCorporativaChange: (value: boolean) => void;
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

const ORIGEM_LABELS: Record<string, string> = {
  todos: "Todos",
  instagram: "Instagram",
  tiktok: "TikTok",
  google: "Google",
  facebook: "Facebook",
  youtube: "YouTube",
  indicacao: "Indicação",
  outro: "Outro",
};

const MIDIA_LABELS: Record<string, string> = {
  todos: "Todas",
  anuncio: "Anúncio",
  organico: "Orgânico",
};

export const BuscaOrdemServico = ({
  busca,
  onBuscaChange,
  statusFiltro,
  onStatusFiltroChange,
  origemFiltro,
  onOrigemFiltroChange,
  midiaFiltro,
  onMidiaFiltroChange,
  dataInicio,
  onDataInicioChange,
  dataFim,
  onDataFimChange,
  mesFiltro,
  onMesFiltroChange,
  lojaFiltro,
  onLojaFiltroChange,
  empresasDisponiveis,
  somenteRemessaCorporativa,
  onSomenteRemessaCorporativaChange,
}: BuscaOrdemServicoProps) => {
  const opcoesMeses = gerarOpcoesMeses();
  const { statusList } = useOSStatusConfig();

  const limparFiltros = () => {
    onDataInicioChange(undefined);
    onDataFimChange(undefined);
    onMesFiltroChange("todos");
    onOrigemFiltroChange("todos");
    onMidiaFiltroChange("todos");
    onLojaFiltroChange?.("todos");
    onSomenteRemessaCorporativaChange(false);
  };

  const temFiltro = !!(dataInicio || dataFim || mesFiltro !== "todos" || origemFiltro !== "todos" || midiaFiltro !== "todos" || (lojaFiltro && lojaFiltro !== "todos") || somenteRemessaCorporativa);

  const statusAtivo = statusList.find((s) => s.slug === statusFiltro);
  const labelPeriodo = dataInicio || dataFim
    ? `${dataInicio ? format(dataInicio, "dd/MM/yy") : "…"} – ${dataFim ? format(dataFim, "dd/MM/yy") : "…"}`
    : mesFiltro !== "todos"
      ? opcoesMeses.find((o) => o.value === mesFiltro)?.label ?? "Todos"
      : "Todos";

  return (
    <div className="flex flex-col gap-3">
      {/* Linha 1: busca + botão de filtros avançados */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Buscar por nome, IMEI, modelo ou nº da OS"
            value={busca}
            onChange={(e) => onBuscaChange(e.target.value)}
            className="h-11 pl-10 rounded-xl bg-muted/30 border-border/50"
          />
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0 rounded-xl bg-muted/30 border-border/50 relative"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {temFiltro && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-primary" />
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>Filtros avançados</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-4 py-4">
              {/* Período detalhado */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Mês</Label>
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

                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Data inicial</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-left font-normal", !dataInicio && "text-muted-foreground")}
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
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Data final</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-left font-normal", !dataFim && "text-muted-foreground")}
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
                </div>
              </div>

              {/* Canal + Mídia + Loja */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Canal de origem</Label>
                  <Select value={origemFiltro} onValueChange={onOrigemFiltroChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Canal de origem" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os Canais</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="tiktok">TikTok</SelectItem>
                      <SelectItem value="google">Google</SelectItem>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="youtube">YouTube</SelectItem>
                      <SelectItem value="indicacao">Indicação</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Tipo de mídia</Label>
                  <Select value={midiaFiltro} onValueChange={onMidiaFiltroChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo de mídia" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas as Mídias</SelectItem>
                      <SelectItem value="anuncio">Anúncio (pago)</SelectItem>
                      <SelectItem value="organico">Orgânico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {onLojaFiltroChange && empresasDisponiveis && empresasDisponiveis.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Loja</Label>
                    <Select value={lojaFiltro ?? "todos"} onValueChange={onLojaFiltroChange}>
                      <SelectTrigger>
                        <Building2 className="h-4 w-4 mr-1 shrink-0" />
                        <SelectValue placeholder="Filtrar por loja" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todas as Lojas</SelectItem>
                        <SelectItem value="matriz">Matriz</SelectItem>
                        {empresasDisponiveis.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Linha 2: chips de filtro resumidos — grid 4 colunas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex flex-col items-start gap-0.5 rounded-xl border border-border/50 bg-muted/20 px-3 py-2 text-left hover:bg-muted/40 transition-colors min-w-0">
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <CalendarIcon className="h-3 w-3 shrink-0" />
                Período
              </span>
              <span className="text-xs font-semibold text-foreground truncate w-full">{labelPeriodo}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="start">
            <div className="flex flex-col gap-3">
              <Select value={mesFiltro} onValueChange={onMesFiltroChange}>
                <SelectTrigger className="w-[220px]">
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
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1 justify-start text-xs font-normal">
                      <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                      {dataInicio ? format(dataInicio, "dd/MM/yy") : "Início"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dataInicio} onSelect={onDataInicioChange} locale={ptBR} initialFocus className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1 justify-start text-xs font-normal">
                      <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                      {dataFim ? format(dataFim, "dd/MM/yy") : "Fim"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dataFim} onSelect={onDataFimChange} locale={ptBR} initialFocus className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <div className="min-w-0">
          <Select value={statusFiltro} onValueChange={onStatusFiltroChange}>
            <SelectTrigger className="h-auto flex-col items-start gap-0.5 rounded-xl border-border/50 bg-muted/20 px-3 py-2 hover:bg-muted/40 [&>svg]:hidden">
              <span className="text-[11px] text-muted-foreground">Status</span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground truncate w-full">
                {statusAtivo && <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: statusAtivo.cor }} />}
                <SelectValue placeholder="Todos" />
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
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

        <div className="min-w-0">
          <Select value={origemFiltro} onValueChange={onOrigemFiltroChange}>
            <SelectTrigger className="h-auto flex-col items-start gap-0.5 rounded-xl border-border/50 bg-muted/20 px-3 py-2 hover:bg-muted/40 [&>svg]:hidden">
              <span className="text-[11px] text-muted-foreground">Canais</span>
              <span className="text-xs font-semibold text-foreground truncate w-full text-left">
                {ORIGEM_LABELS[origemFiltro] ?? "Todos"}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Canais</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="tiktok">TikTok</SelectItem>
              <SelectItem value="google">Google</SelectItem>
              <SelectItem value="facebook">Facebook</SelectItem>
              <SelectItem value="youtube">YouTube</SelectItem>
              <SelectItem value="indicacao">Indicação</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-0">
          <Select value={midiaFiltro} onValueChange={onMidiaFiltroChange}>
            <SelectTrigger className="h-auto flex-col items-start gap-0.5 rounded-xl border-border/50 bg-muted/20 px-3 py-2 hover:bg-muted/40 [&>svg]:hidden">
              <span className="text-[11px] text-muted-foreground">Mídias</span>
              <span className="text-xs font-semibold text-foreground truncate w-full text-left">
                {MIDIA_LABELS[midiaFiltro] ?? "Todas"}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as Mídias</SelectItem>
              <SelectItem value="anuncio">Anúncio (pago)</SelectItem>
              <SelectItem value="organico">Orgânico</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Linha 3: Remessa Corporativa + Limpar filtros */}
      <div className="flex items-center justify-between flex-wrap gap-2 rounded-xl border border-border/50 bg-muted/20 px-3.5 py-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <Switch
            id="somente-remessa-corporativa"
            checked={somenteRemessaCorporativa}
            onCheckedChange={onSomenteRemessaCorporativaChange}
            className="shrink-0"
          />
          <Label htmlFor="somente-remessa-corporativa" className="flex items-center gap-1.5 text-sm font-medium cursor-pointer min-w-0">
            <Package className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="truncate">Remessa Corporativa</span>
          </Label>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={limparFiltros}
          disabled={!temFiltro}
          className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground disabled:opacity-40 shrink-0"
        >
          <RotateCcw className="h-3.5 w-3.5 shrink-0" />
          Limpar filtros
        </Button>
      </div>
    </div>
  );
};
