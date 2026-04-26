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
import { Calendar, Filter } from "lucide-react";

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

type PresetType = "hoje" | "ontem" | "7dias" | "mes_atual" | "por_mes" | "personalizado";

interface FiltroPeriodoAvancadoProps {
  onFiltrar: (filtros: FiltrosPeriodo) => void;
  loading?: boolean;
  showTipoFiltro?: boolean;
  tipoFiltro?: string;
  onTipoFiltroChange?: (tipo: string) => void;
}

const anos = Array.from({ length: 2035 - 2020 + 1 }, (_, i) => (2035 - i).toString());

export function FiltroPeriodoAvancado({
  onFiltrar,
  loading,
  showTipoFiltro,
  tipoFiltro,
  onTipoFiltroChange,
}: FiltroPeriodoAvancadoProps) {
  const [preset, setPreset] = useState<PresetType>("mes_atual");
  const [mesSelecionado, setMesSelecionado] = useState(
    String(new Date().getMonth() + 1).padStart(2, "0")
  );
  const [anoSelecionado, setAnoSelecionado] = useState(
    new Date().getFullYear().toString()
  );
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const calcularFiltros = (p: PresetType): FiltrosPeriodo => {
    const hoje = new Date();
    const formatDate = (d: Date) => d.toISOString().split("T")[0];

    switch (p) {
      case "hoje":
        return { dataInicio: formatDate(hoje), dataFim: formatDate(hoje) };
      case "ontem": {
        const ontem = new Date(hoje);
        ontem.setDate(ontem.getDate() - 1);
        return { dataInicio: formatDate(ontem), dataFim: formatDate(ontem) };
      }
      case "7dias": {
        const seteDias = new Date(hoje);
        seteDias.setDate(seteDias.getDate() - 6);
        return { dataInicio: formatDate(seteDias), dataFim: formatDate(hoje) };
      }
      case "mes_atual": {
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
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

  const presets: { value: PresetType; label: string }[] = [
    { value: "hoje", label: "Hoje" },
    { value: "ontem", label: "Ontem" },
    { value: "7dias", label: "7 dias" },
    { value: "mes_atual", label: "Este mês" },
    { value: "por_mes", label: "Por mês" },
    { value: "personalizado", label: "Personalizado" },
  ];

  return (
    <div className="bg-muted/30 rounded-lg p-3 space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <Button
            key={p.value}
            variant={preset === p.value ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs px-2.5"
            onClick={() => handlePreset(p.value)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {(preset === "por_mes" || preset === "personalizado" || showTipoFiltro) && (
        <div className="flex flex-wrap items-end gap-2">
          {preset === "por_mes" && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Mês</Label>
                <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
                  <SelectTrigger className="h-8 text-xs w-[120px]">
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
                  <SelectTrigger className="h-8 text-xs w-[90px]">
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
                  className="h-8 text-xs w-[150px]"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fim</Label>
                <Input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="h-8 text-xs w-[150px]"
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
                <SelectTrigger className="h-8 text-xs w-[110px]">
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
              className="h-8 text-xs"
            >
              <Filter className="h-3 w-3 mr-1" />
              Filtrar
            </Button>
          )}

          <Button
            variant="outline"
            onClick={handleLimpar}
            disabled={loading}
            size="sm"
            className="h-8 text-xs"
          >
            Limpar
          </Button>
        </div>
      )}
    </div>
  );
}
