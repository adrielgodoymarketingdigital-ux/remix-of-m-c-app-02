// Topo da tela Pedidos / Encomendas no computador (>= 1024px): cabeçalho, abas e os
// 4 indicadores. Só visual: recebe o estado e os handlers da página. Abaixo de 1024px
// a página não usa este componente.
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ClipboardList, Clock, Plus, ShoppingBag, ShoppingCart, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ResumoPedidos } from "@/lib/pedidos/listaPedidosDesktop";

export type AbaPedidos = "pedidos" | "lista";

interface TopoPedidosDesktopProps {
  aba: AbaPedidos;
  onAba: (aba: AbaPedidos) => void;
  /** Indicadores de todos os pedidos (não seguem busca nem status), como hoje. */
  resumo: ResumoPedidos;
  loading: boolean;
  onNovoPedido: () => void;
}

interface Indicador {
  rotulo: string;
  valor: number;
  legenda: string;
  Icone: LucideIcon;
  cor: string;
  corValor: string;
}

export function TopoPedidosDesktop(p: TopoPedidosDesktopProps) {
  const { t } = useTranslation("pedidos", { keyPrefix: "telaDesktop" });
  const { resumo } = p;

  // Cores dos números = as dos cartões de sempre (amarelo, roxo e vermelho).
  const indicadores: Indicador[] = [
    {
      rotulo: t("indicadores.total"),
      valor: resumo.total,
      legenda: t("indicadores.totalLegenda"),
      Icone: ClipboardList,
      cor: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      corValor: "",
    },
    {
      rotulo: t("indicadores.aguardando"),
      valor: resumo.aguardando,
      legenda: t("indicadores.aguardandoLegenda"),
      Icone: Clock,
      cor: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      corValor: "text-yellow-600 dark:text-yellow-400",
    },
    {
      rotulo: t("indicadores.chegaram"),
      valor: resumo.chegou,
      legenda: t("indicadores.chegaramLegenda"),
      Icone: Truck,
      cor: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
      corValor: "text-purple-600 dark:text-purple-400",
    },
    {
      // Quantidade de pedidos não pagos em aberto, não valor em dinheiro: não some com o olho.
      rotulo: t("indicadores.aReceber"),
      valor: resumo.aReceber,
      legenda: t("indicadores.aReceberLegenda"),
      Icone: ShoppingBag,
      cor: "bg-red-500/10 text-red-600 dark:text-red-400",
      corValor: "text-red-600 dark:text-red-400",
    },
  ];

  const abas: { id: AbaPedidos; rotulo: string; Icone: LucideIcon }[] = [
    { id: "pedidos", rotulo: t("abas.pedidos"), Icone: ClipboardList },
    { id: "lista", rotulo: t("abas.listaCompras"), Icone: ShoppingCart },
  ];

  return (
    <div className="space-y-5">
      {/* pt-6: o olho flutuante do layout (fixed top-4 right-4) ficaria por cima do botão. */}
      <div className="flex items-center justify-between gap-4 pt-6">
        <div className="min-w-0">
          <h1 className="text-[28px] font-bold leading-9 tracking-tight">{t("titulo")}</h1>
          <p className="text-sm leading-5 text-muted-foreground">{t("subtitulo")}</p>
        </div>
        {/* Como hoje: "Novo Pedido" só na aba Pedidos (a Lista de Compras tem o próprio "Nova lista"). */}
        {p.aba === "pedidos" && (
          <Button onClick={p.onNovoPedido} className="h-11 shrink-0 rounded-xl px-5">
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("novoPedido")}
          </Button>
        )}
      </div>

      <div role="tablist" aria-label={t("abasRotulo")} className="inline-flex gap-1 rounded-xl border bg-muted p-1">
        {abas.map(({ id, rotulo, Icone }) => {
          const ativa = p.aba === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={ativa}
              onClick={() => p.onAba(id)}
              className={cn(
                "flex min-w-[160px] items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                ativa
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
              )}
            >
              <Icone className="h-4 w-4" aria-hidden="true" />
              {rotulo}
            </button>
          );
        })}
      </div>

      {/* Indicadores só na aba Pedidos, como hoje. 4 lado a lado quando cabem rótulo e
          legenda; a regra olha a largura da área ao lado do menu (aberto ou recolhido). */}
      {p.aba === "pedidos" && (
        <div className="[container-type:inline-size]">
          <div className="grid grid-cols-2 gap-4 [@container(min-width:1100px)]:grid-cols-4">
            {indicadores.map(({ rotulo, valor, legenda, Icone, cor, corValor }) => (
              <Card key={rotulo} className="flex min-w-0 items-center gap-4 rounded-2xl p-5 shadow-sm">
                <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${cor}`}>
                  <Icone className="h-6 w-6" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{rotulo}</p>
                  {p.loading ? (
                    <Skeleton className="my-1 h-7 w-16" />
                  ) : (
                    <p className={cn("text-2xl font-bold leading-8 tabular-nums", corValor)}>{valor}</p>
                  )}
                  {p.loading ? (
                    <Skeleton className="h-3 w-24" />
                  ) : (
                    <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{legenda}</p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
