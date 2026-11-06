import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  Calendar,
  CalendarDays,
  CalendarRange,
  Clock,
  Filter,
  History,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { nowBrasilia } from "@/lib/dataBrasilia";
import { cn } from "@/lib/utils";

export interface FiltrosPeriodo {
  dataInicio: string;
  dataFim: string;
}

const MESES = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

export type PresetType = "hoje" | "ontem" | "7dias" | "mes_atual" | "por_mes" | "personalizado";

interface FiltroPeriodoAvancadoProps {
  onFiltrar: (filtros: FiltrosPeriodo) => void;
  loading?: boolean;
  showTipoFiltro?: boolean;
  tipoFiltro?: string;
  onTipoFiltroChange?: (tipo: string) => void;
  /** Opcional: quais períodos mostrar e com que rótulo (padrão: os 6 de sempre). */
  opcoes?: { value: PresetType; label: string }[];
  /** Opcional: esconde o botão "Limpar" (quem usa sempre precisa de um período). */
  ocultarLimpar?: boolean;
  /** Opcional: no celular, períodos em grade de 2 colunas em vez de uma linha rolando. */
  opcoesEmGrade?: boolean;
  /**
   * Opcional: visual do computador (lg+) da Análise de Lucros e Custos — períodos
   * numa barra com ícones e Tipo/Limpar alinhados à direita. Abaixo de lg nada muda.
   * Sem a prop, a saída é a mesma de sempre.
   */
  visualDesktop?: boolean;
}

/** Ícone de cada período no visual do computador (só aparece em lg+). */
const ICONE_PRESET: Record<PresetType, LucideIcon> = {
  hoje: Clock,
  ontem: History,
  "7dias": CalendarRange,
  mes_atual: CalendarDays,
  por_mes: BarChart3,
  personalizado: Calendar,
};

const anos = Array.from({ length: 2035 - 2020 + 1 }, (_, i) => (2035 - i).toString());

export function FiltroPeriodoAvancado({
  onFiltrar,
  loading,
  showTipoFiltro,
  tipoFiltro,
  onTipoFiltroChange,
  opcoes,
  ocultarLimpar,
  opcoesEmGrade,
  visualDesktop,
}: FiltroPeriodoAvancadoProps) {
  const [preset, setPreset] = useState<PresetType>("mes_atual");
  const [mesSelecionado, setMesSelecionado] = useState(
    String(nowBrasilia().getUTCMonth() + 1).padStart(2, "0")
  );
  const [anoSelecionado, setAnoSelecionado] = useState(
    nowBrasilia().getUTCFullYear().toString()
  );
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const calcularFiltros = (p: PresetType): FiltrosPeriodo => {
    // hoje é um Date "de parede" de Brasília (ver src/lib/dataBrasilia.ts) — a
    // partir daqui só usar getters/setters UTC* nele, nunca os locais (que
    // reinterpretariam o instante no fuso do navegador, não no de Brasília).
    const hoje = nowBrasilia();
    const formatDate = (d: Date) => d.toISOString().split("T")[0];

    switch (p) {
      case "hoje":
        return { dataInicio: formatDate(hoje), dataFim: formatDate(hoje) };
      case "ontem": {
        const ontem = new Date(hoje);
        ontem.setUTCDate(ontem.getUTCDate() - 1);
        return { dataInicio: formatDate(ontem), dataFim: formatDate(ontem) };
      }
      case "7dias": {
        const seteDias = new Date(hoje);
        seteDias.setUTCDate(seteDias.getUTCDate() - 6);
        return { dataInicio: formatDate(seteDias), dataFim: formatDate(hoje) };
      }
      case "mes_atual": {
        const inicioMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1));
        const fimMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 0));
        return { dataInicio: formatDate(inicioMes), dataFim: formatDate(fimMes) };
      }
      case "por_mes": {
        if (mesSelecionado && anoSelecionado) {
          const ano = parseInt(anoSelecionado);
          const mes = parseInt(mesSelecionado);
          const ultimoDia = new Date(ano, mes, 0).getDate();
          return {
            dataInicio: `${anoSelecionado}-${mesSelecionado}-01`,
            dataFim: `${anoSelecionado}-${mesSelecionado}-${String(ultimoDia).padStart(2, "0")}`,
          };
        }
        return { dataInicio: "", dataFim: "" };
      }
      case "personalizado":
        return { dataInicio, dataFim };
      default:
        return { dataInicio: "", dataFim: "" };
    }
  };

  const handlePreset = (p: PresetType) => {
    setPreset(p);
    if (p !== "por_mes" && p !== "personalizado") {
      onFiltrar(calcularFiltros(p));
    }
  };

  const handleFiltrar = () => {
    onFiltrar(calcularFiltros(preset));
  };

  const handleLimpar = () => {
    setPreset("mes_atual");
    setDataInicio("");
    setDataFim("");
    onTipoFiltroChange?.("todos");
    onFiltrar({ dataInicio: "", dataFim: "" });
  };

  const presetsPadrao: { value: PresetType; label: string }[] = [
    { value: "hoje", label: "Hoje" },
    { value: "ontem", label: "Ontem" },
    { value: "7dias", label: "7 dias" },
    { value: "mes_atual", label: "Este mês" },
    { value: "por_mes", label: "Por mês" },
    { value: "personalizado", label: "Personalizado" },
  ];
  const presets = opcoes ?? presetsPadrao;

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-2 sm:p-3 space-y-3 shadow-sm",
        visualDesktop &&
          "lg:flex lg:flex-wrap lg:items-end lg:justify-between lg:gap-3 lg:space-y-0 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none",
      )}
    >
      {/* Celular: uma linha só, rolando para o lado. sm+: quebra linha como antes.
          p-1/-m-1 dão espaço para o anel de foco não ser cortado pela rolagem. */}
      <div className={cn(
        "-m-1 gap-1.5 p-1 sm:flex sm:flex-wrap sm:overflow-visible",
        opcoesEmGrade ? "grid grid-cols-2" : "flex overflow-x-auto scrollbar-hide",
        visualDesktop && "lg:m-0 lg:w-fit lg:gap-1 lg:rounded-2xl lg:border lg:bg-card lg:p-1 lg:shadow-sm",
      )}>
        {presets.map((p) => {
          const Icone = ICONE_PRESET[p.value];
          return (
            <Button
              key={p.value}
              variant={preset === p.value ? "default" : "outline"}
              size="sm"
              aria-pressed={preset === p.value}
              className={cn(
                "h-11 shrink-0 rounded-xl px-4 text-[13px] sm:h-8 sm:px-3 sm:text-xs",
                visualDesktop && "lg:h-9 lg:gap-1.5 lg:px-3.5 lg:text-[13px]",
                visualDesktop && preset !== p.value && "lg:border-transparent lg:shadow-none",
              )}
              onClick={() => handlePreset(p.value)}
            >
              {visualDesktop && <Icone aria-hidden="true" className="hidden h-4 w-4 lg:block" />}
              {p.label}
            </Button>
          );
        })}
      </div>

      {(preset === "por_mes" || preset === "personalizado" || showTipoFiltro) && (
        <div className={cn("flex flex-wrap items-end gap-2", visualDesktop && "lg:justify-end")}>
          {preset === "por_mes" && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Mês</Label>
                <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
                  <SelectTrigger className={cn("h-11 sm:h-8 text-xs w-[120px]", visualDesktop && "lg:h-9")}>
                    <SelectValue placeholder="Mês" />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ano</Label>
                <Select value={anoSelecionado} onValueChange={setAnoSelecionado}>
                  <SelectTrigger className={cn("h-11 sm:h-8 text-xs w-[90px]", visualDesktop && "lg:h-9")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {anos.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {preset === "personalizado" && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Início</Label>
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className={cn("h-11 sm:h-8 text-xs w-[150px]", visualDesktop && "lg:h-9")}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fim</Label>
                <Input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className={cn("h-11 sm:h-8 text-xs w-[150px]", visualDesktop && "lg:h-9")}
                />
              </div>
            </>
          )}

          {showTipoFiltro && (
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select
                value={tipoFiltro || "todos"}
                onValueChange={(v) => onTipoFiltroChange?.(v)}
              >
                <SelectTrigger className={cn("h-11 sm:h-8 text-xs w-[110px]", visualDesktop && "lg:h-9 lg:w-[160px] lg:rounded-xl lg:bg-card")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="dispositivo">Dispositivos</SelectItem>
                  <SelectItem value="produto">Produtos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {(preset === "por_mes" || preset === "personalizado") && (
            <Button
              onClick={handleFiltrar}
              disabled={loading}
              size="sm"
              className={cn("h-11 sm:h-8 text-xs", visualDesktop && "lg:h-9 lg:rounded-xl")}
            >
              <Filter className="h-3 w-3 mr-1" />
              Filtrar
            </Button>
          )}

          {!ocultarLimpar && (
            <Button
              variant="outline"
              onClick={handleLimpar}
              disabled={loading}
              size="sm"
              className={cn("h-11 sm:h-8 text-xs", visualDesktop && "lg:h-9 lg:gap-1.5 lg:rounded-xl lg:bg-card lg:px-3.5")}
            >
              {visualDesktop && <Trash2 aria-hidden="true" className="hidden h-3.5 w-3.5 lg:block" />}
              Limpar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
