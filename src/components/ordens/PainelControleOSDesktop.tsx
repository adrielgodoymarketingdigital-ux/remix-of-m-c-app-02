import type { ReactNode } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Download, Plus, Settings, SlidersHorizontal, Upload, Wrench, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface PainelControleOSDesktopProps {
  contadorOS: { usadas: number; limite: number; ilimitado: boolean };
  onNovaCompleta: () => void;
  onNovaSimplificada: () => void;
  onImportar: () => void;
  onExportar: () => void;
  onAvulso: () => void;
  menuConfiguracoes: ReactNode;
  meses: { valor: string; data: Date }[];
  mesFiltro: string;
  onMesFiltroChange: (mes: string) => void;
  dataInicio?: Date;
  onDataInicioChange: (data: Date | undefined) => void;
  dataFim?: Date;
  onDataFimChange: (data: Date | undefined) => void;
  onLimparPeriodo: () => void;
}

// Azul fixo: o painel não segue a cor personalizada da loja. Sem hover/foco claros, o tema padrão sumiria no azul.
const classeFoco = "focus-visible:ring-white/70 focus-visible:ring-offset-0";
const classeAcao = cn(
  "h-10 gap-2 rounded-lg border-[#48a0ff] bg-[#00449a]/25 px-4 font-semibold text-white hover:bg-white/15 hover:text-white dark:border-white/25 dark:bg-white/5",
  classeFoco,
);
const classeCampo =
  "h-10 rounded-lg border border-white/15 bg-white/10 text-sm font-medium text-white hover:bg-white/15 hover:text-white";

const rotuloMes = (data: Date) => {
  const rotulo = format(data, "MMMM 'de' yyyy", { locale: ptBR });
  return rotulo.charAt(0).toUpperCase() + rotulo.slice(1);
};

/** Vale também para mês fora da lista (o filtro de baixo oferece meses futuros). */
const rotuloDoFiltro = (mes: string) => {
  if (mes === "todos") return "Todos os meses";
  const [ano, mesNum] = mes.split("-").map(Number);
  return rotuloMes(new Date(ano, mesNum - 1, 1));
};

function CampoData({
  rotulo,
  vazio,
  data,
  mesInicial,
  onChange,
}: {
  rotulo: string;
  vazio: string;
  data?: Date;
  mesInicial?: Date;
  onChange: (data: Date | undefined) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={rotulo}
          className={cn(classeCampo, classeFoco, "w-[112px] justify-start gap-2 px-3 tabular-nums", !data && "text-white/85")}
        >
          <CalendarIcon className="h-4 w-4 shrink-0" />
          {data ? format(data, "dd/MM") : vazio}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={data}
          onSelect={onChange}
          defaultMonth={data ?? mesInicial}
          locale={ptBR}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}

export function PainelControleOSDesktop({
  contadorOS,
  onNovaCompleta,
  onNovaSimplificada,
  onImportar,
  onExportar,
  onAvulso,
  menuConfiguracoes,
  meses,
  mesFiltro,
  onMesFiltroChange,
  dataInicio,
  onDataInicioChange,
  dataFim,
  onDataFimChange,
  onLimparPeriodo,
}: PainelControleOSDesktopProps) {
  return (
    <section className="relative overflow-hidden rounded-[19px] border border-transparent bg-[linear-gradient(115deg,#0865c8_0%,#07439f_48%,#06246f_100%)] px-6 py-5 text-white shadow-[0_8px_20px_rgba(15,62,143,0.12)] dark:border-white/10 dark:bg-[linear-gradient(115deg,#0c2f66_0%,#0a2350_50%,#071a3d_100%)]">
      {/* Onda do fundo: estica com o painel, por isso preserveAspectRatio="none". */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-90 dark:opacity-50"
        viewBox="0 0 1000 300"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="painel-os-onda" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#1f6bff" stopOpacity="0.15" />
            <stop offset="0.6" stopColor="#1f6bff" stopOpacity="0.75" />
            <stop offset="1" stopColor="#0a3bb0" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        <path d="M540 300C680 262 722 132 820 62C872 26 930 6 1000 0V300Z" fill="url(#painel-os-onda)" />
        <path d="M660 300C760 272 806 176 884 118C930 84 968 68 1000 62V300Z" fill="#0b2f9e" fillOpacity="0.28" />
      </svg>

      <div className="relative flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-[14px] bg-[#1178e5] dark:bg-[#1a5bb5]">
            <SlidersHorizontal className="h-7 w-7" />
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold tracking-tight text-white">Centro de Controle</h1>
            <p className="truncate text-[13px] text-[#e6f1ff]">Acompanhe e gerencie todas as ordens de serviço</p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {!contadorOS.ilimitado && (
              <div className="flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1 font-mono text-xs text-white">
                <span className="font-semibold">{contadorOS.usadas}</span>
                <span>/</span>
                <span>{contadorOS.limite}</span>
                <span className="text-[10px]">OS</span>
              </div>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "os-nova-btn h-10 gap-2 rounded-lg border-0 bg-white px-4 font-semibold text-[#15233d] shadow-md hover:bg-white hover:text-[#15233d] hover:brightness-95",
                    classeFoco,
                  )}
                >
                  <Plus />
                  Nova OS
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onNovaCompleta}>Completa</DropdownMenuItem>
                <DropdownMenuItem onClick={onNovaSimplificada}>Simplificada</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onImportar} className={classeAcao}>
            <Upload />
            Importar
          </Button>
          <Button variant="outline" size="sm" onClick={onExportar} className={classeAcao}>
            <Download />
            Exportar
          </Button>
          <Button variant="outline" size="sm" onClick={onAvulso} className={classeAcao}>
            <Wrench />
            Avulso
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className={classeAcao}>
                <Settings />
                Configurações
              </Button>
            </DropdownMenuTrigger>
            {menuConfiguracoes}
          </DropdownMenu>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={mesFiltro} onValueChange={onMesFiltroChange}>
            <SelectTrigger
              aria-label="Período"
              className={cn(
                classeCampo,
                "w-[208px] justify-start gap-2 px-3 focus:ring-white/70 focus:ring-offset-0 [&>svg:last-child]:ml-auto [&>svg:last-child]:opacity-90",
              )}
            >
              <CalendarIcon className="h-4 w-4 shrink-0" />
              <SelectValue>{rotuloDoFiltro(mesFiltro)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os meses</SelectItem>
              {meses.map(({ valor, data }) => (
                <SelectItem key={valor} value={valor}>
                  {rotuloMes(data)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <CampoData rotulo="Data inicial" vazio="início" data={dataInicio} mesInicial={dataFim} onChange={onDataInicioChange} />
          <span className="px-1 text-sm text-white">até</span>
          <CampoData rotulo="Data final" vazio="fim" data={dataFim} mesInicial={dataInicio} onChange={onDataFimChange} />

          {(dataInicio || dataFim || mesFiltro !== "todos") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onLimparPeriodo}
              aria-label="Limpar período"
              title="Limpar período"
              className={cn("h-10 w-10 p-0 text-white hover:bg-white/15 hover:text-white", classeFoco)}
            >
              <X />
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
