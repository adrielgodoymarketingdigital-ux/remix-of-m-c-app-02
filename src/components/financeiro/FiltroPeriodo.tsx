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

export interface FiltrosPeriodo {
  dataInicio: string;
  dataFim: string;
}

interface FiltroPeriodoProps {
  onFiltrar: (filtros: FiltrosPeriodo) => void;
  loading?: boolean;
  showTipoFiltro?: boolean;
  tipoFiltro?: string;
  onTipoFiltroChange?: (tipo: string) => void;
}

const anos = Array.from({ length: 2035 - 2020 + 1 }, (_, i) => (2035 - i).toString());

export function FiltroPeriodo({ onFiltrar, loading, showTipoFiltro, tipoFiltro, onTipoFiltroChange }: FiltroPeriodoProps) {
  const [tipoFiltroData, setTipoFiltroData] = useState<"dia" | "mes" | "ano" | "periodo">("mes");
  const [diaSelecionado, setDiaSelecionado] = useState("");
  const [mesSelecionado, setMesSelecionado] = useState("");
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear().toString());
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const calcularFiltros = (): FiltrosPeriodo => {
    if (tipoFiltroData === "dia" && diaSelecionado) {
      return { dataInicio: diaSelecionado, dataFim: diaSelecionado };
    }
    if (tipoFiltroData === "mes" && mesSelecionado && anoSelecionado) {
      const ano = parseInt(anoSelecionado);
      const mes = parseInt(mesSelecionado);
      const ultimoDia = new Date(ano, mes, 0).getDate();
      return {
        dataInicio: `${anoSelecionado}-${mesSelecionado}-01`,
        dataFim: `${anoSelecionado}-${mesSelecionado}-${String(ultimoDia).padStart(2, '0')}`,
      };
    }
    if (tipoFiltroData === "ano" && anoSelecionado) {
      return {
        dataInicio: `${anoSelecionado}-01-01`,
        dataFim: `${anoSelecionado}-12-31`,
      };
    }
    if (tipoFiltroData === "periodo") {
      return { dataInicio, dataFim };
    }
    return { dataInicio: "", dataFim: "" };
  };

  const handleFiltrar = () => {
    onFiltrar(calcularFiltros());
  };

  const handleLimpar = () => {
    setDiaSelecionado("");
    setMesSelecionado("");
    setAnoSelecionado(new Date().getFullYear().toString());
    setDataInicio("");
    setDataFim("");
    onTipoFiltroChange?.("todos");
    onFiltrar({ dataInicio: "", dataFim: "" });
  };

  return (
    <div className="bg-muted/30 rounded-lg p-3 space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {(["dia", "mes", "ano", "periodo"] as const).map((tipo) => (
          <Button
            key={tipo}
            variant={tipoFiltroData === tipo ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs px-2.5"
            onClick={() => setTipoFiltroData(tipo)}
          >
            {tipo === "dia" && "Dia"}
            {tipo === "mes" && "Mês"}
            {tipo === "ano" && "Ano"}
            {tipo === "periodo" && "Período"}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        {tipoFiltroData === "dia" && (
          <div className="space-y-1">
            <Label className="text-xs">Data</Label>
            <Input
              type="date"
              value={diaSelecionado}
              onChange={(e) => setDiaSelecionado(e.target.value)}
              className="h-8 text-xs w-[150px]"
            />
          </div>
        )}

        {tipoFiltroData === "mes" && (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Mês</Label>
              <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
                <SelectTrigger className="h-8 text-xs w-[120px]">
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                  {MESES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
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
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {tipoFiltroData === "ano" && (
          <div className="space-y-1">
            <Label className="text-xs">Ano</Label>
            <Select value={anoSelecionado} onValueChange={setAnoSelecionado}>
              <SelectTrigger className="h-8 text-xs w-[90px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {anos.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {tipoFiltroData === "periodo" && (
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
            <Select value={tipoFiltro || "todos"} onValueChange={(v) => onTipoFiltroChange?.(v)}>
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

        <Button onClick={handleFiltrar} disabled={loading} size="sm" className="h-8 text-xs">
          <Filter className="h-3 w-3 mr-1" />
          Filtrar
        </Button>
        <Button variant="outline" onClick={handleLimpar} disabled={loading} size="sm" className="h-8 text-xs">
          Limpar
        </Button>
      </div>
    </div>
  );
}
