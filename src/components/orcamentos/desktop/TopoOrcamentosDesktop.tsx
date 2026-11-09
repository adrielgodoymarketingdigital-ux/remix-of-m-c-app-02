// Topo da tela Orçamentos no computador (>= 1024px): cabeçalho (engrenagem do layout
// de impressão e Novo Orçamento) e os 4 cartões. Só visual: recebe os números e os
// handlers da página. Abaixo de 1024px a página não usa este componente.
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, CircleDollarSign, Clock, FileText, Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { formatCurrency } from "@/lib/formatters";
import type { ResumoOrcamentos } from "@/lib/orcamentos/listaOrcamentosDesktop";

interface TopoOrcamentosDesktopProps {
  /** Cartões sobre todos os orçamentos (não seguem busca, status nem período). */
  resumo: ResumoOrcamentos;
  carregando: boolean;
  onConfigurarLayout: () => void;
  onNovoOrcamento: () => void;
}

interface Indicador {
  rotulo: string;
  valor: ReactNode;
  /** Texto do valor como aparece na tela: define a fonte que cabe sem cortar. */
  textoValor: string;
  Icone: LucideIcon;
  /** Quadrado do ícone. */
  corIcone: string;
  /** Leve tom do cartão, como no mockup. */
  fundo: string;
  corValor?: string;
}

// Mesma regra dos cartões de Serviços: a fonte diminui com a largura do cartão (cqi)
// e o valor nunca é cortado.
const LARGURA_CARACTERE_EM = 0.64;
const fonteQueCabe = (texto: string) => ({
  fontSize: `min(1.75rem, calc(100cqi / ${(Math.max(texto.length, 1) * LARGURA_CARACTERE_EM).toFixed(2)}))`,
});

export function TopoOrcamentosDesktop(p: TopoOrcamentosDesktopProps) {
  const { t } = useTranslation("comum", { keyPrefix: "orcamentos" });
  const { resumo } = p;
  const numero = (n: number) => ({ valor: n, textoValor: String(n) });

  const indicadores: Indicador[] = [
    {
      rotulo: t("indicadores.total"),
      ...numero(resumo.total),
      Icone: FileText,
      corIcone: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      fundo: "from-blue-500/[0.05]",
    },
    {
      rotulo: t("indicadores.pendentes"),
      ...numero(resumo.pendentes),
      Icone: Clock,
      corIcone: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      fundo: "from-amber-500/[0.07]",
    },
    {
      rotulo: t("indicadores.aprovados"),
      ...numero(resumo.aprovados),
      Icone: CheckCircle2,
      corIcone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      fundo: "from-emerald-500/[0.06]",
    },
    {
      rotulo: t("indicadores.valorAprovado"),
      // tipo="preco": valor de orçamento é preço ao cliente, nunca some com o olho (como em Pedidos).
      valor: <ValorMonetario valor={resumo.valorAprovado} tipo="preco" />,
      textoValor: formatCurrency(resumo.valorAprovado),
      Icone: CircleDollarSign,
      corIcone: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
      fundo: "from-sky-500/[0.05]",
      corValor: "text-primary",
    },
  ];

  return (
    <div className="space-y-5">
      {/* pt-6: o olho flutuante do layout (BotaoOcultarValores, fixed top-4 right-4) ficaria por cima dos botões. */}
      <div className="flex items-center justify-between gap-4 pt-6">
        <div className="min-w-0">
          <h1 className="text-[32px] font-bold leading-10 tracking-tight">{t("titulo")}</h1>
          <p className="text-base leading-6 text-muted-foreground">{t("subtitulo")}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={p.onConfigurarLayout}
            title={t("configurarLayout")}
            aria-label={t("configurarLayout")}
            className="h-11 w-11 rounded-xl"
          >
            <Settings className="h-5 w-5" aria-hidden="true" />
          </Button>
          <Button onClick={p.onNovoOrcamento} className="h-11 rounded-xl px-5">
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("novoOrcamento")}
          </Button>
        </div>
      </div>

      {/* 4 cartões lado a lado a partir de 880px de área ao lado do menu (aberto ou
          recolhido); senão 2×2. Abaixo de 1100px (cartão < ~260px, ex.: 1280 com menu
          aberto) o cartão fica mais justo para o rótulo caber numa linha também em es. */}
      <div className="[container-type:inline-size]">
        <div className="grid grid-cols-2 gap-4 [@container(min-width:880px)]:grid-cols-4">
          {indicadores.map(({ rotulo, valor, textoValor, Icone, corIcone, fundo, corValor }) => (
            <Card
              key={rotulo}
              className={`flex min-w-0 items-center gap-4 rounded-2xl bg-gradient-to-br ${fundo} to-transparent p-5 shadow-sm [@container(min-width:880px)_and_(max-width:1099px)]:gap-3 [@container(min-width:880px)_and_(max-width:1099px)]:p-4`}
            >
              <div
                className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${corIcone} [@container(min-width:880px)_and_(max-width:1099px)]:h-10 [@container(min-width:880px)_and_(max-width:1099px)]:w-10`}
              >
                <Icone className="h-6 w-6 [@container(min-width:880px)_and_(max-width:1099px)]:h-5 [@container(min-width:880px)_and_(max-width:1099px)]:w-5" aria-hidden="true" />
              </div>
              {/* O tamanho do rótulo fica neste div: dentro dele a consulta de container
                  olharia este próprio div (o do valor), e não a área dos cartões. */}
              <div className="min-w-0 flex-1 text-sm [container-type:inline-size] [@container(min-width:880px)_and_(max-width:1099px)]:text-[13px]">
                <p className="text-muted-foreground [overflow-wrap:anywhere]">{rotulo}</p>
                {p.carregando ? (
                  <Skeleton className="mt-1 h-8 w-16" />
                ) : (
                  <p
                    className={`font-bold leading-9 tabular-nums [overflow-wrap:anywhere] ${corValor ?? ""}`}
                    style={fonteQueCabe(textoValor)}
                  >
                    {valor}
                  </p>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
