import { useState } from "react";
import {
  Target, TrendingUp, Zap, BarChart2,
  AlertTriangle, Pencil, Check, X, HelpCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatCurrency } from "@/lib/formatters";
import { useOSGerencial } from "@/hooks/useOSGerencial";

interface Props {
  dataInicio?: Date;
  dataFim?: Date;
  onAbrirOS?: (id: string) => void;
}

function HelpButton({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="shrink-0 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors focus:outline-none"
          aria-label={title}
        >
          <HelpCircle className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-72 text-xs space-y-2">
        {children}
      </PopoverContent>
    </Popover>
  );
}

function Chip({
  cor,
  icon,
  label,
  valor,
  extra,
  helpTitle,
  helpContent,
}: {
  cor: string;
  icon: React.ReactNode;
  label: string;
  valor: string;
  extra?: string;
  helpTitle: string;
  helpContent: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 min-w-0"
      style={{ borderColor: `${cor}40` }}
    >
      <div
        className="h-6 w-6 rounded-md flex items-center justify-center shrink-0"
        style={{ background: `${cor}18` }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60 leading-none mb-0.5">
          {label}
        </p>
        <p className="text-xs font-black font-mono tabular-nums leading-none truncate" style={{ color: cor }}>
          {valor}
        </p>
        {extra && (
          <p className="text-[9px] text-muted-foreground/50 font-mono leading-none mt-0.5 truncate">{extra}</p>
        )}
      </div>
      <HelpButton title={helpTitle}>{helpContent}</HelpButton>
    </div>
  );
}

function ChipSkeleton() {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
      <Skeleton className="h-6 w-6 rounded-md shrink-0" />
      <div className="space-y-1">
        <Skeleton className="h-2 w-12" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

export function OSResumoBarra({ dataInicio, dataFim, onAbrirOS }: Props) {
  const { data, diasUteis, meta, carregando, salvarMeta } = useOSGerencial(dataInicio, dataFim);

  const [editandoMeta, setEditandoMeta] = useState(false);
  const [inputMeta, setInputMeta] = useState("");

  const { diasUteisMes, diasUteisPassados } = diasUteis;

  const valorRealizado = data?.valorRealizado ?? 0;
  const metaValor = meta ?? 0;
  const osParadasCount = data?.osParadasCount ?? 0;

  const pctMeta = metaValor > 0 ? Math.min((valorRealizado / metaValor) * 100, 100) : 0;
  const pctEsperado = diasUteisMes > 0 ? (diasUteisPassados / diasUteisMes) * 100 : 0;
  const pctReal = metaValor > 0 ? (valorRealizado / metaValor) * 100 : 0;
  const ritmoDiario = diasUteisPassados > 0 ? valorRealizado / diasUteisPassados : 0;
  const projecao = ritmoDiario * diasUteisMes;

  const corMeta = metaValor > 0
    ? pctMeta >= 80 ? "#22c55e" : pctMeta >= 50 ? "#eab308" : "#ef4444"
    : "#6b7280";
  const ratioSemaforo = pctEsperado > 0 ? pctReal / pctEsperado : 0;
  const corSemaforo = metaValor > 0
    ? ratioSemaforo >= 1 ? "#22c55e" : ratioSemaforo >= 0.7 ? "#eab308" : "#ef4444"
    : "#6b7280";
  const labelSemaforo = ratioSemaforo >= 1 ? "No ritmo" : ratioSemaforo >= 0.7 ? "Atenção" : "Crítico";
  const corRitmo = metaValor > 0
    ? ritmoDiario * diasUteisMes >= metaValor ? "#22c55e"
      : ritmoDiario * diasUteisMes >= metaValor * 0.8 ? "#eab308"
      : "#ef4444"
    : "#6b7280";
  const corProjecao = metaValor > 0
    ? projecao >= metaValor ? "#22c55e"
      : projecao >= metaValor * 0.8 ? "#eab308"
      : "#ef4444"
    : "#6b7280";

  async function confirmarMeta() {
    const val = parseFloat(inputMeta.replace(",", "."));
    if (isNaN(val) || val <= 0) return;
    await salvarMeta(val);
    setEditandoMeta(false);
  }

  function abrirEdicao() {
    setInputMeta(metaValor > 0 ? String(metaValor) : "");
    setEditandoMeta(true);
  }

  return (
    <div className="space-y-2">
      {/* Banner OS paradas */}
      {osParadasCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            <span className="font-semibold">Atenção imediata</span> —{" "}
            {osParadasCount === 1
              ? "1 OS com 3 dias ou mais parada. Precisa de ação agora."
              : `${osParadasCount} OS com 3 dias ou mais paradas. Elas precisam de ação agora.`}
          </span>
          {onAbrirOS && osParadasCount === 1 && data?.osParadas?.[0] && (
            <button
              className="ml-auto shrink-0 underline underline-offset-2 text-[10px] hover:opacity-80"
              onClick={() => onAbrirOS(data.osParadas[0].id)}
            >
              Ver OS
            </button>
          )}
        </div>
      )}

      {/* Chips de indicadores */}
      <div className="flex flex-wrap gap-2">
        {carregando ? (
          <>
            <ChipSkeleton />
            <ChipSkeleton />
            <ChipSkeleton />
            <ChipSkeleton />
          </>
        ) : (
          <>
            {/* META */}
            {editandoMeta ? (
              <div className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2">
                <Input
                  autoFocus
                  className="h-6 w-28 text-xs font-mono"
                  placeholder="Ex: 15000"
                  value={inputMeta}
                  onChange={(e) => setInputMeta(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmarMeta();
                    if (e.key === "Escape") setEditandoMeta(false);
                  }}
                />
                <button
                  onClick={confirmarMeta}
                  className="h-6 w-6 rounded flex items-center justify-center text-green-500 hover:text-green-400 transition-colors"
                >
                  <Check className="h-3 w-3" />
                </button>
                <button
                  onClick={() => setEditandoMeta(false)}
                  className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div
                className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 min-w-0 group"
                style={{ borderColor: `${corMeta}40` }}
              >
                <div
                  className="h-6 w-6 rounded-md flex items-center justify-center shrink-0"
                  style={{ background: `${corMeta}18` }}
                >
                  <Target className="h-3.5 w-3.5" style={{ color: corMeta }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60 leading-none mb-0.5">
                    Meta OS
                  </p>
                  {metaValor > 0 ? (
                    <>
                      <p className="text-xs font-black font-mono tabular-nums leading-none" style={{ color: corMeta }}>
                        {pctMeta.toFixed(0)}% — {formatCurrency(valorRealizado)}
                      </p>
                      <div className="h-1 w-20 rounded-full bg-muted/50 overflow-hidden mt-1">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pctMeta}%`, backgroundColor: corMeta }}
                        />
                      </div>
                    </>
                  ) : (
                    <p className="text-[10px] text-muted-foreground/50 leading-none">
                      {formatCurrency(valorRealizado)}
                    </p>
                  )}
                </div>
                <button
                  onClick={abrirEdicao}
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/40 hover:text-muted-foreground"
                  title="Definir meta"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <HelpButton title="O que é Meta OS?">
                  <p className="font-semibold text-sm">Meta OS</p>
                  <p className="text-muted-foreground leading-relaxed">
                    Soma em R$ das suas OS em andamento, finalizadas e entregues no período. Clique no lápis ✏️ para definir sua meta mensal e acompanhar o progresso.
                  </p>
                </HelpButton>
              </div>
            )}

            {/* SEMÁFORO */}
            <div
              className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 min-w-0"
              style={{ borderColor: `${corSemaforo}40` }}
            >
              <div
                className="h-6 w-6 rounded-md flex items-center justify-center shrink-0"
                style={{ background: `${corSemaforo}18` }}
              >
                <TrendingUp className="h-3.5 w-3.5" style={{ color: corSemaforo }} />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60 leading-none mb-0.5">
                  Semáforo
                </p>
                {metaValor > 0 ? (
                  <>
                    <p className="text-xs font-black font-mono leading-none" style={{ color: corSemaforo }}>
                      {labelSemaforo}
                    </p>
                    <p className="text-[9px] text-muted-foreground/50 font-mono leading-none mt-0.5">
                      {pctReal.toFixed(0)}% / {pctEsperado.toFixed(0)}%
                    </p>
                  </>
                ) : (
                  <p className="text-[10px] text-muted-foreground/40 leading-none">Sem meta</p>
                )}
              </div>
              <HelpButton title="Como funciona o Semáforo?">
                <p className="font-semibold text-sm">Semáforo</p>
                <p className="text-muted-foreground leading-relaxed">
                  Compara o que você já fez com o que era esperado para esse momento do mês. Se o mês tem 22 dias úteis e hoje é o dia 11, o esperado é que você já tenha feito 50% da sua meta.
                </p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>🟢 <span className="font-medium text-foreground">No ritmo</span> — igual ou acima do esperado</li>
                  <li>🟡 <span className="font-medium text-foreground">Atenção</span> — um pouco abaixo do esperado</li>
                  <li>🔴 <span className="font-medium text-foreground">Crítico</span> — muito abaixo do esperado</li>
                </ul>
              </HelpButton>
            </div>

            {/* RITMO DIÁRIO */}
            <Chip
              cor={corRitmo}
              icon={<Zap className="h-3.5 w-3.5" style={{ color: corRitmo }} />}
              label="Ritmo Diário"
              valor={diasUteisPassados > 0 ? formatCurrency(ritmoDiario) : "—"}
              extra={`${diasUteisPassados}/${diasUteisMes} dias úteis`}
              helpTitle="O que é Ritmo Diário?"
              helpContent={
                <>
                  <p className="font-semibold text-sm">Ritmo Diário</p>
                  <p className="text-muted-foreground leading-relaxed">
                    Quanto você está faturando em média por dia útil trabalhado no mês. Calculado com base no valor real das suas OS dividido pelos dias úteis já passados.
                  </p>
                </>
              }
            />

            {/* PROJEÇÃO */}
            <Chip
              cor={corProjecao}
              icon={<BarChart2 className="h-3.5 w-3.5" style={{ color: corProjecao }} />}
              label="Projeção"
              valor={diasUteisPassados > 0 ? formatCurrency(projecao) : "—"}
              extra="Projeção de fechamento"
              helpTitle="O que é Projeção?"
              helpContent={
                <>
                  <p className="font-semibold text-sm">Projeção</p>
                  <p className="text-muted-foreground leading-relaxed">
                    Se você mantiver o ritmo atual até o fim do mês, esse é o valor estimado de fechamento. Calculado multiplicando seu ritmo diário pelo total de dias úteis do mês.
                  </p>
                </>
              }
            />
          </>
        )}
      </div>
    </div>
  );
}
