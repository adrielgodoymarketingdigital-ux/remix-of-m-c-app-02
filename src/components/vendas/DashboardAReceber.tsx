import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Venda } from "@/types/venda";
import { useTranslation } from "react-i18next";
import { useFormatadores } from "@/hooks/useFormatadores";
import { cn } from "@/lib/utils";
import { TextoAjustado } from "@/components/vendas/TextoAjustado";
import { useMemo, type ReactNode } from "react";
import { Clock, AlertTriangle, CheckCircle, DollarSign, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { getVendaReceitaLiquida } from "@/lib/vendasFinanceiras";
import { aReceberComTrocaNaTela } from "@/lib/vendas/trocaPDV";

interface DashboardAReceberProps {
  vendas: Venda[];
  loading?: boolean;
  onMarcarRecebido?: (vendaId: string) => Promise<boolean>;
}

export const DashboardAReceber = ({
  vendas,
  loading,
  onMarcarRecebido,
}: DashboardAReceberProps) => {
  const { t } = useTranslation("vendas");
  const fmt = useFormatadores();
  // Venda com troca: o que falta receber é a conta a receber (sem a troca); sem troca, a conta de sempre.
  const aReceberComTroca = useMemo(() => aReceberComTrocaNaTela(vendas), [vendas]);
  const valorAReceber = (v: Venda) => aReceberComTroca.get(v.id)?.valor ?? getVendaReceitaLiquida(v);

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  
  const em3Dias = new Date(hoje);
  em3Dias.setDate(hoje.getDate() + 3);

  // Filtrar apenas vendas a receber não canceladas e não recebidas
  const vendasAReceber = vendas.filter(
    (v) =>
      (v.forma_pagamento === "a_receber" || v.forma_pagamento === "a_prazo") &&
      !v.recebido &&
      !v.cancelada
  );

  const totalAReceber = vendasAReceber.reduce(
    (acc, v) => acc + valorAReceber(v),
    0
  );

  const vendasVencidas = vendasAReceber.filter((v) => {
    if (!v.data_prevista_recebimento) return false;
    const dataVencimento = new Date(v.data_prevista_recebimento);
    dataVencimento.setHours(0, 0, 0, 0);
    return dataVencimento < hoje;
  });

  const vendasVencendo = vendasAReceber.filter((v) => {
    if (!v.data_prevista_recebimento) return false;
    const dataVencimento = new Date(v.data_prevista_recebimento);
    dataVencimento.setHours(0, 0, 0, 0);
    return dataVencimento >= hoje && dataVencimento <= em3Dias;
  });

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-2 min-[381px]:gap-[11px] md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="min-h-[154px] rounded-[17px] border border-border bg-card p-[15px]">
            <Skeleton className="h-[43px] w-[43px] rounded-[13px]" />
            <Skeleton className="mt-4 h-4 w-20" />
            <Skeleton className="mt-2 h-7 w-24" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cards de resumo */}
      <div className="grid grid-cols-2 gap-2 min-[381px]:gap-[11px] md:grid-cols-4">
        <CardReceber
          cor="azul"
          decoracao="curva"
          rotulo={t("aReceber.total")}
          Icone={DollarSign}
          caracteres={fmt.moeda(totalAReceber).length}
          valor={<ValorMonetario valor={totalAReceber} />}
          descricao={t("aReceber.pendentes", { count: vendasAReceber.length })}
        />
        <CardReceber
          cor="vermelho"
          decoracao="barras"
          rotulo={t("aReceber.vencidas")}
          Icone={AlertTriangle}
          caracteres={String(vendasVencidas.length).length}
          valor={vendasVencidas.length}
          descricao={<ValorMonetario valor={vendasVencidas.reduce((acc, v) => acc + valorAReceber(v), 0)} />}
        />
        <CardReceber
          cor="laranja"
          decoracao="curva"
          rotulo={t("aReceber.vencendo3Dias")}
          Icone={Clock}
          caracteres={String(vendasVencendo.length).length}
          valor={vendasVencendo.length}
          descricao={<ValorMonetario valor={vendasVencendo.reduce((acc, v) => acc + valorAReceber(v), 0)} />}
        />
        <CardReceber
          cor="roxo"
          decoracao="barras"
          rotulo={t("aReceber.quantidade")}
          Icone={CheckCircle}
          caracteres={String(vendasAReceber.length).length}
          valor={vendasAReceber.length}
          descricao={t("aReceber.quantidadeDescricao")}
        />
      </div>

      {/* Lista de vendas a receber */}
      {vendasAReceber.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("aReceber.listaTitulo")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {vendasAReceber.map((venda) => {
                const dataVencimento = venda.data_prevista_recebimento
                  ? new Date(venda.data_prevista_recebimento)
                  : null;
                if (dataVencimento) dataVencimento.setHours(0, 0, 0, 0);

                const isVencida = dataVencimento && dataVencimento < hoje;
                const isVencendo =
                  dataVencimento &&
                  dataVencimento >= hoje &&
                  dataVencimento <= em3Dias;

                return (
                  <div
                    key={venda.id}
                    className="flex flex-col gap-2 p-3 rounded-lg border bg-card sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-sm break-words">
                          {venda.tipo === "dispositivo" && venda.dispositivos
                            ? `${venda.dispositivos.marca} ${venda.dispositivos.modelo}`
                            : venda.produtos?.nome || t("aReceber.venda")}
                        </span>
                        {isVencida && (
                          <Badge variant="destructive" className="text-xs">
                            {t("aReceber.vencida")}
                          </Badge>
                        )}
                        {isVencendo && !isVencida && (
                          <Badge className="bg-orange-500 text-xs">
                            {t("aReceber.vencendo")}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t("aReceber.linhaCliente", {
                          cliente: venda.clientes?.nome || t("aReceber.clienteNaoInformado"),
                          vencimento: venda.data_prevista_recebimento
                            ? t("aReceber.vencimento", { data: fmt.data(venda.data_prevista_recebimento) })
                            : t("aReceber.semData"),
                        })}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                      <span className="font-semibold whitespace-nowrap">
                        <ValorMonetario valor={valorAReceber(venda)} tipo="preco" />
                        {aReceberComTroca.has(venda.id) && (
                          <span className="block text-right text-[10px] font-normal text-amber-600">
                            {t("aReceber.troca", { valor: fmt.moeda(aReceberComTroca.get(venda.id)?.trocaVenda ?? 0) })}
                          </span>
                        )}
                      </span>
                      {onMarcarRecebido && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onMarcarRecebido(venda.id)}
                          className="text-green-600 border-green-600 hover:bg-green-50"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          {t("aReceber.recebido")}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

type CorReceber = "azul" | "vermelho" | "laranja" | "roxo";

// Cores da referência no claro; no escuro, tons do próprio Tailwind sobre o card do tema.
const ESTILO_RECEBER: Record<CorReceber, { card: string; icone: string; valor: string; traco: string; preenchimento: string; barra: string }> = {
  azul: {
    card: "border-[#C7DBFF] bg-[linear-gradient(135deg,#FFFFFF,#F0F6FF)] dark:border-blue-500/25 dark:bg-[linear-gradient(135deg,hsl(var(--card)),rgba(59,130,246,0.10))]",
    icone: "bg-[#E3EDFF] text-[#246BFF] dark:bg-blue-500/15 dark:text-blue-400",
    valor: "text-[#246BFF] dark:text-blue-400",
    traco: "#7DAFFF", preenchimento: "#7DAFFF", barra: "",
  },
  vermelho: {
    card: "border-[#F8DEDE] bg-[linear-gradient(135deg,#FFFFFF,#FFF6F6)] dark:border-red-500/25 dark:bg-[linear-gradient(135deg,hsl(var(--card)),rgba(239,68,68,0.10))]",
    icone: "bg-[#FFE6E6] text-[#E02424] dark:bg-red-500/15 dark:text-red-400",
    valor: "text-[#E02424] dark:text-red-400",
    traco: "", preenchimento: "", barra: "bg-[linear-gradient(#FF3B45,#FFD0D3)] dark:bg-[linear-gradient(#F87171,rgba(248,113,113,0.15))]",
  },
  laranja: {
    card: "border-[#F5E7D7] bg-[linear-gradient(135deg,#FFFFFF,#FFF9F1)] dark:border-orange-500/25 dark:bg-[linear-gradient(135deg,hsl(var(--card)),rgba(249,115,22,0.10))]",
    icone: "bg-[#FFF0DF] text-[#FF8500] dark:bg-orange-500/15 dark:text-orange-400",
    valor: "text-[#FF8500] dark:text-orange-400",
    traco: "#FFB25C", preenchimento: "#FFB25C", barra: "",
  },
  roxo: {
    card: "border-[#E9DDF9] bg-[linear-gradient(135deg,#FFFFFF,#FAF5FF)] dark:border-purple-500/25 dark:bg-[linear-gradient(135deg,hsl(var(--card)),rgba(168,85,247,0.10))]",
    icone: "bg-[#F3E5FF] text-[#A02CFA] dark:bg-purple-500/15 dark:text-purple-400",
    valor: "text-foreground",
    traco: "", preenchimento: "", barra: "bg-[linear-gradient(#B842F4,#E9C5FA)] dark:bg-[linear-gradient(#C084FC,rgba(192,132,252,0.15))]",
  },
};

interface CardReceberProps {
  cor: CorReceber;
  decoracao: "curva" | "barras";
  rotulo: string;
  Icone: LucideIcon;
  valor: ReactNode;
  /** Caracteres do valor exibido, para ajustar a fonte sem cortar dígitos. */
  caracteres: number;
  descricao: ReactNode;
}

function CardReceber({ cor, decoracao, rotulo, Icone, valor, caracteres, descricao }: CardReceberProps) {
  const e = ESTILO_RECEBER[cor];
  const idGradiente = `receber-${cor}`;
  return (
    <article
      aria-label={rotulo}
      className={cn(
        "relative min-h-[154px] overflow-hidden rounded-[17px] border p-[11px] min-[381px]:p-[15px]",
        "shadow-[0_4px_15px_rgba(16,24,40,0.035)] dark:shadow-none",
        e.card,
      )}
    >
      {/* Decoração de fundo: fica atrás do texto (z-0) e na faixa de baixo do card */}
      {decoracao === "curva" ? (
        <svg aria-hidden="true" viewBox="0 0 200 43" preserveAspectRatio="none" className="pointer-events-none absolute bottom-0 left-0 z-0 h-[43px] w-full">
          <defs>
            <linearGradient id={idGradiente} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={e.preenchimento} stopOpacity="0.28" />
              <stop offset="1" stopColor={e.preenchimento} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0 37 C20 38 25 29 40 34 S65 22 82 31 S110 38 130 27 S165 8 180 19 S195 40 200 34 V43 H0 Z" fill={`url(#${idGradiente})`} />
          <path d="M0 37 C20 38 25 29 40 34 S65 22 82 31 S110 38 130 27 S165 8 180 19 S195 40 200 34" fill="none" stroke={e.traco} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
      ) : (
        <div aria-hidden="true" className="pointer-events-none absolute bottom-3 right-[13px] z-0 flex h-[50px] items-end gap-[5px] opacity-70">
          {[12, 21, 32, 44].map((altura) => (
            <span key={altura} className={cn("w-[9px] rounded-[4px_4px_0_0]", e.barra)} style={{ height: altura }} />
          ))}
        </div>
      )}

      <div className="relative z-10 flex items-start gap-[7px] min-[381px]:gap-[9px]">
        <div className={cn("flex h-[35px] w-[35px] shrink-0 items-center justify-center rounded-[13px] min-[381px]:h-[43px] min-[381px]:w-[43px]", e.icone)}>
          <Icone className="h-5 w-5 min-[381px]:h-6 min-[381px]:w-6" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="mb-[7px] text-[10px] leading-[1.4] text-muted-foreground min-[381px]:text-[11px]">{rotulo}</p>
          <div className={cn("font-extrabold leading-tight tracking-[-0.7px]", e.valor)}>
            <TextoAjustado caracteres={caracteres} min={13} max={27} classeReserva="text-lg min-[381px]:text-[22px]">
              {valor}
            </TextoAjustado>
          </div>
          <p className="mt-1.5 text-[10px] leading-normal text-muted-foreground">{descricao}</p>
        </div>
      </div>
    </article>
  );
}
