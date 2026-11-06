import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CardFinanceiroClicavel } from "./CardFinanceiroClicavel";
import { ESTILO_TOM, MOLDURA_CARD_FINANCEIRO } from "./estiloCardFinanceiro";
import { cn } from "@/lib/utils";
import { FiltroPeriodoAvancado, FiltrosPeriodo } from "./FiltroPeriodoAvancado";
import { GraficoEvolucao } from "./GraficoEvolucao";
import { GraficoRanking } from "./GraficoRanking";
import { TabelaLucros } from "./TabelaLucros";
import { AnalistaFinanceiro } from "./AnalistaFinanceiro";
import { DetalhesCardLucros } from "./DetalhesCardLucros";
import { TabelaVendas } from "@/components/vendas/TabelaVendas";
import { useVendas } from "@/hooks/useVendas";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { useOcultarValores } from "@/contexts/OcultarValoresContext";
import {
  DollarSign,
  TrendingDown,
  TrendingUp,
  Percent,
  Receipt,
  CreditCard,
  Wallet,
  Lock,
  ChevronDown,
  ChevronRight,
  BarChart3,
  CalendarDays,
  type LucideIcon,
} from "lucide-react";
import {
  LucroPorItem,
  EvolucaoMensal,
  ResumoFinanceiro,
  FiltrosRelatorio,
} from "@/types/relatorio";

type CardAtivoLucros =
  | "faturado"
  | "custo_total"
  | "custo_operacional"
  | "lucro_bruto"
  | "lucro_liquido"
  | "margem"
  | "taxas_cartao"
  | null;

interface SecaoAnaliseLucrosCustosProps {
  loading: boolean;
  calcularLucroPorItem: (filtros: FiltrosRelatorio) => Promise<LucroPorItem[]>;
  calcularEvolucaoMensal: (filtros: FiltrosRelatorio) => Promise<EvolucaoMensal[]>;
  calcularResumo: (filtros: FiltrosRelatorio) => Promise<ResumoFinanceiro>;
  onFiltroChange?: (filtro: FiltrosPeriodo, tipo: string) => void;
}

const resumoVazio: ResumoFinanceiro = {
  receitaTotal: 0,
  custoTotal: 0,
  lucroTotal: 0,
  margemLucroMedia: 0,
  custoOperacional: 0,
  lucroLiquido: 0,
  taxasCartao: 0,
};

export function SecaoAnaliseLucrosCustos({
  loading,
  calcularLucroPorItem,
  calcularEvolucaoMensal,
  calcularResumo,
  onFiltroChange,
}: SecaoAnaliseLucrosCustosProps) {
  const { podeVerCustos, podeVerLucros, isFuncionario } = useFuncionarioPermissoes();
  const { valoresOcultos } = useOcultarValores();
  const { vendas: vendasDetalhadas, loading: loadingVendas, carregarVendas } = useVendas();

  const [filtros, setFiltros] = useState<FiltrosPeriodo>({ dataInicio: "", dataFim: "" });
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [lucros, setLucros] = useState<LucroPorItem[]>([]);
  const [evolucao, setEvolucao] = useState<EvolucaoMensal[]>([]);
  const [resumo, setResumo] = useState<ResumoFinanceiro>(resumoVazio);
  const [secaoLucroItem, setSecaoLucroItem] = useState(false);
  const [secaoVendasDetalhadas, setSecaoVendasDetalhadas] = useState(false);
  const [cardAtivo, setCardAtivo] = useState<CardAtivoLucros>(null);

  const carregarDados = useCallback(
    async (f: FiltrosPeriodo, tipo: string) => {
      const filtrosRelatorio: FiltrosRelatorio = {
        dataInicio: f.dataInicio,
        dataFim: f.dataFim,
        tipo: tipo as any,
      };

      const [lucrosData, evolucaoData, resumoData] = await Promise.all([
        calcularLucroPorItem(filtrosRelatorio),
        calcularEvolucaoMensal(filtrosRelatorio),
        calcularResumo(filtrosRelatorio),
        carregarVendas(f.dataInicio, f.dataFim),
      ]);

      setLucros(lucrosData);
      setEvolucao(evolucaoData);
      setResumo(resumoData);
    },
    [calcularLucroPorItem, calcularEvolucaoMensal, calcularResumo, carregarVendas]
  );

  // Mesmo filtro de tipo usado nos cards/tabela acima — aplicado aqui só na
  // exibição (client-side), sem refazer a query, já que useVendas já buscou
  // as vendas do período.
  const vendasDoPeriodo = useMemo(
    () => (tipoFiltro === "todos" ? vendasDetalhadas : vendasDetalhadas.filter((v) => v.tipo === tipoFiltro)),
    [vendasDetalhadas, tipoFiltro]
  );

  useEffect(() => {
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    const formatDate = (d: Date) => d.toISOString().split("T")[0];
    const filtroInicial = { dataInicio: formatDate(inicioMes), dataFim: formatDate(fimMes) };
    setFiltros(filtroInicial);
    carregarDados(filtroInicial, "todos");
    onFiltroChange?.(filtroInicial, "todos");
  }, []);

  const handleFiltrar = (f: FiltrosPeriodo) => {
    setFiltros(f);
    carregarDados(f, tipoFiltro);
    onFiltroChange?.(f, tipoFiltro);
  };

  const handleTipoChange = (tipo: string) => {
    setTipoFiltro(tipo);
    carregarDados(filtros, tipo);
    onFiltroChange?.(filtros, tipo);
  };

  const toggleCard = (card: CardAtivoLucros) => {
    setCardAtivo((prev) => (prev === card ? null : card));
  };

  // "Ver todos" das tabelas do computador: abre a "Análise de Lucro por Item"
  // (que já lista todos os itens) e leva a tela e o foco até ela.
  const secaoLucroItemRef = useRef<HTMLButtonElement>(null);
  const verTodosItens = () => {
    setSecaoLucroItem(true);
    requestAnimationFrame(() => {
      const botao = secaoLucroItemRef.current;
      if (!botao) return;
      botao.focus({ preventScroll: true });
      botao.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  // Período do filtro atual, só para leitura no cabeçalho do computador.
  const dataBR = (d: string) => d.split("-").reverse().join("/");
  const periodoTexto =
    filtros.dataInicio && filtros.dataFim
      ? filtros.dataInicio === filtros.dataFim
        ? dataBR(filtros.dataInicio)
        : `${dataBR(filtros.dataInicio)} - ${dataBR(filtros.dataFim)}`
      : null;

  if (isFuncionario) return null;

  return (
    <div className="border-t pt-6 space-y-4 lg:space-y-5">
      {/* Cabeçalho. No computador: ícone à esquerda e período (só leitura) à direita. */}
      <div className="lg:flex lg:items-center lg:justify-between lg:gap-4">
        <div className="lg:flex lg:items-center lg:gap-4">
          <div
            aria-hidden="true"
            className="hidden h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm lg:grid"
          >
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Análise de Lucros e Custos</h2>
            <p className="text-muted-foreground text-sm">
              Métricas de desempenho financeiro da empresa
            </p>
          </div>
        </div>
        {periodoTexto && (
          <div className="hidden h-10 shrink-0 items-center gap-2 rounded-xl border bg-card px-3.5 text-sm font-medium tabular-nums shadow-sm lg:flex">
            <CalendarDays aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
            {periodoTexto}
          </div>
        )}
      </div>

      <FiltroPeriodoAvancado
        onFiltrar={handleFiltrar}
        loading={loading}
        showTipoFiltro
        tipoFiltro={tipoFiltro}
        onTipoFiltroChange={handleTipoChange}
        visualDesktop
      />

      {/* Cards: 2 colunas no celular, 4+3 no computador e 7 numa linha a partir de ~1360px.
          valorAjustavel: o valor encolhe em vez de ser cortado com "…". */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 min-[1360px]:grid-cols-7">
        <CardFinanceiroClicavel
          titulo="Total Faturado"
          tom="verde"
          valor={resumo.receitaTotal}
          subtitulo="Receita total"
          icon={DollarSign}
          valorColor="text-green-600"
          ativo={cardAtivo === "faturado"}
          onClick={() => toggleCard("faturado")}
          valorAjustavel
          carregando={loading}
        />
        {podeVerCustos ? (
          <CardFinanceiroClicavel
            titulo="Custo Total"
            tom="vermelho"
            valor={resumo.custoTotal}
            subtitulo="Custo dos produtos"
            icon={TrendingDown}
            valorColor="text-destructive"
            ativo={cardAtivo === "custo_total"}
            onClick={() => toggleCard("custo_total")}
            valorAjustavel
            carregando={loading}
          />
        ) : (
          <CardComLock titulo="Custo Total" icon={TrendingDown} />
        )}
        {podeVerCustos ? (
          <CardFinanceiroClicavel
            titulo="Custo Operacional"
            tom="laranja"
            valor={resumo.custoOperacional}
            subtitulo="Contas pagas no período"
            icon={Receipt}
            iconColor="text-orange-600"
            valorColor="text-orange-600"
            ativo={cardAtivo === "custo_operacional"}
            onClick={() => toggleCard("custo_operacional")}
            valorAjustavel
            carregando={loading}
          />
        ) : (
          <CardComLock titulo="Custo Operacional" icon={Receipt} />
        )}
        {podeVerLucros ? (
          <CardFinanceiroClicavel
            titulo="Lucro Bruto"
            tom="azul"
            valor={resumo.lucroTotal}
            subtitulo="Receita - custo"
            icon={TrendingUp}
            ativo={cardAtivo === "lucro_bruto"}
            onClick={() => toggleCard("lucro_bruto")}
            valorAjustavel
            carregando={loading}
          />
        ) : (
          <CardComLock titulo="Lucro Bruto" icon={TrendingUp} />
        )}
        {podeVerLucros ? (
          <CardFinanceiroClicavel
            titulo="Lucro Líquido"
            tom={resumo.lucroLiquido >= 0 ? "verde" : "vermelho"}
            valor={resumo.lucroLiquido}
            subtitulo="Bruto - despesas"
            icon={Wallet}
            valorColor={resumo.lucroLiquido >= 0 ? "text-green-600" : "text-destructive"}
            ativo={cardAtivo === "lucro_liquido"}
            onClick={() => toggleCard("lucro_liquido")}
            valorAjustavel
            carregando={loading}
          />
        ) : (
          <CardComLock titulo="Lucro Líquido" icon={Wallet} />
        )}
        {podeVerLucros ? (
          <CardFinanceiroClicavel
            titulo="Margem de Lucro"
            tom="azul"
            valor={resumo.margemLucroMedia}
            subtitulo="Média do período"
            icon={Percent}
            tipo="percentual"
            ativo={cardAtivo === "margem"}
            onClick={() => toggleCard("margem")}
            valorAjustavel
            carregando={loading}
          />
        ) : (
          <CardComLock titulo="Margem de Lucro" icon={Percent} />
        )}
        {podeVerCustos ? (
          <CardFinanceiroClicavel
            titulo="Taxas de Cartão"
            tom="roxo"
            valor={resumo.taxasCartao}
            subtitulo="Taxas de máquinas"
            icon={CreditCard}
            iconColor="text-purple-600"
            valorColor="text-purple-600"
            ativo={cardAtivo === "taxas_cartao"}
            onClick={() => toggleCard("taxas_cartao")}
            valorAjustavel
            carregando={loading}
          />
        ) : (
          <CardComLock titulo="Taxas de Cartão" icon={CreditCard} />
        )}
      </div>

      {/* Detalhes expandidos do card ativo */}
      {cardAtivo && (
        <DetalhesCardLucros
          cardAtivo={cardAtivo}
          lucros={lucros}
          resumo={resumo}
        />
      )}

      {/* Gráficos */}
      <GraficoEvolucao dados={evolucao} loading={loading} />
      <GraficoRanking itens={lucros} loading={loading} onVerTodos={verTodosItens} />

      {/* Análise de Lucro por Item */}
      <Collapsible open={secaoLucroItem} onOpenChange={setSecaoLucroItem}>
        <Card className="rounded-2xl">
          <CardHeader>
            <CollapsibleTrigger asChild>
              <button ref={secaoLucroItemRef} className="flex items-center gap-2 w-full text-left scroll-mt-6">
                {secaoLucroItem ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <CardTitle className="text-lg sm:text-2xl">Análise de Lucro por Item</CardTitle>
              </button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <TabelaLucros itens={lucros} loading={loading} />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Vendas do período agrupadas por venda (múltiplos produtos em uma só linha, expansível) */}
      <Collapsible open={secaoVendasDetalhadas} onOpenChange={setSecaoVendasDetalhadas}>
        <Card className="rounded-2xl">
          <CardHeader>
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 w-full text-left">
                {secaoVendasDetalhadas ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <CardTitle className="text-lg sm:text-2xl">Vendas Detalhadas do Período</CardTitle>
              </button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <TabelaVendas vendas={vendasDoPeriodo} loading={loadingVendas} />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Analista Financeiro IA */}
      <AnalistaFinanceiro resumo={resumo} lucros={lucros} evolucao={evolucao} />
    </div>
  );
}

// Card com ícone de bloqueio (sem permissão: continua sem ação nenhuma)
function CardComLock({ titulo, icon: Icon }: { titulo: string; icon: LucideIcon }) {
  return (
    <Card className={cn(MOLDURA_CARD_FINANCEIRO, "bg-muted/30 [container-type:inline-size]")}>
      {/* Computador, cartão estreito: ícone em cima do título (igual ao CardFinanceiroClicavel). */}
      <div className="flex items-start gap-2.5 lg:[@container(max-width:139px)]:flex-col lg:[@container(max-width:139px)]:gap-2">
        <div
          aria-hidden="true"
          className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl sm:h-10 sm:w-10", ESTILO_TOM.neutro.caixa)}
        >
          <Icon className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
        </div>
        <h3 className="min-w-0 flex-1 pt-0.5 text-xs sm:text-[13px] font-medium leading-snug text-foreground line-clamp-2">
          {titulo}
        </h3>
      </div>
      <div className="mt-2.5 flex items-center gap-2 text-muted-foreground">
        <Lock className="h-4 w-4 shrink-0" />
        <span className="text-sm">Sem permissão</span>
      </div>
    </Card>
  );
}
