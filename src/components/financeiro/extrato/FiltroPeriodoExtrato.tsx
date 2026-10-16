import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, RefreshCw } from "lucide-react";
import { nowBrasilia } from "@/lib/dataBrasilia";
import { cn } from "@/lib/utils";
import type { FiltrosPeriodo } from "@/components/financeiro/FiltroPeriodoAvancado";

/**
 * Variante visual do FiltroPeriodoAvancado só para a tela de Extrato
 * (referência layout-extrato). O componente original é compartilhado com
 * Financeiro e outras seções, por isso não foi alterado. Opções, estados e o
 * cálculo das datas (calcularFiltros) são cópia fiel do original — mudou só o
 * visual. Se a regra de datas mudar lá, replicar aqui.
 */

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

interface FiltroPeriodoExtratoProps {
  onFiltrar: (filtros: FiltrosPeriodo) => void;
  loading?: boolean;
}

const anos = Array.from({ length: 2035 - 2020 + 1 }, (_, i) => (2035 - i).toString());

const FOCO = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#A7C8FF] focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const CHIP = cn(
  "shrink-0 whitespace-nowrap rounded-xl border border-border bg-card px-4 py-[13px] text-xs font-medium text-[#101828] shadow-[0_2px_8px_rgba(16,24,40,0.03)] transition hover:bg-muted/60 dark:text-foreground",
  FOCO,
);
const CHIP_ATIVO = "border-transparent bg-[linear-gradient(110deg,#246BFF,#079FD0)] text-white shadow-[0_5px_15px_rgba(36,107,255,0.18)] hover:bg-transparent hover:brightness-105 dark:text-white";
const CAMPO = "h-11 rounded-xl border-border bg-card text-sm";
const ROTULO = "text-xs text-muted-foreground";
const BOTAO = cn(
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition disabled:pointer-events-none disabled:opacity-50 [&>svg]:h-[17px] [&>svg]:w-[17px]",
  FOCO,
);

export function FiltroPeriodoExtrato({ onFiltrar, loading }: FiltroPeriodoExtratoProps) {
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
    <div className="space-y-3">
      {/* Chips: rolagem horizontal no celular, sem barra visível */}
      <div
        role="group"
        aria-label="Período"
        className="-mx-6 flex gap-2 overflow-x-auto px-6 py-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {presets.map((p) => (
          <button
            key={p.value}
            type="button"
            aria-pressed={preset === p.value}
            className={cn(CHIP, preset === p.value && CHIP_ATIVO)}
            onClick={() => handlePreset(p.value)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {(preset === "por_mes" || preset === "personalizado") && (
        <div className="flex flex-wrap items-end gap-2.5 rounded-2xl border border-border bg-card p-3">
          {preset === "por_mes" && (
            <>
              <div className="min-w-[130px] flex-1 space-y-1 sm:flex-none">
                <Label className={ROTULO}>Mês</Label>
                <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
                  <SelectTrigger className={cn(CAMPO, "sm:w-[150px]")}>
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
              <div className="min-w-[100px] flex-1 space-y-1 sm:flex-none">
                <Label className={ROTULO}>Ano</Label>
                <Select value={anoSelecionado} onValueChange={setAnoSelecionado}>
                  <SelectTrigger className={cn(CAMPO, "sm:w-[110px]")}>
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
              <div className="min-w-[140px] flex-1 space-y-1 sm:flex-none">
                <Label className={ROTULO}>Início</Label>
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className={cn(CAMPO, "sm:w-[170px]")}
                />
              </div>
              <div className="min-w-[140px] flex-1 space-y-1 sm:flex-none">
                <Label className={ROTULO}>Fim</Label>
                <Input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className={cn(CAMPO, "sm:w-[170px]")}
                />
              </div>
            </>
          )}

          <div className="flex w-full gap-2.5 sm:w-auto">
            <button
              type="button"
              onClick={handleFiltrar}
              disabled={loading}
              className={cn(BOTAO, "flex-1 bg-[linear-gradient(110deg,#246BFF,#079FD0)] text-white shadow-[0_5px_15px_rgba(36,107,255,0.18)] hover:brightness-105 sm:flex-none")}
            >
              <Filter aria-hidden="true" />
              Filtrar
            </button>
            <button
              type="button"
              onClick={handleLimpar}
              disabled={loading}
              className={cn(BOTAO, "flex-1 border border-border bg-card text-[#0B1429] hover:bg-muted/60 dark:text-foreground sm:flex-none")}
            >
              <RefreshCw aria-hidden="true" />
              Limpar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
