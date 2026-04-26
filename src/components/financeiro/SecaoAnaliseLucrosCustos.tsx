import { useState, useEffect, useCallback, useMemo } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CardFinanceiroClicavel } from "./CardFinanceiroClicavel";
import { FiltroPeriodoAvancado, FiltrosPeriodo } from "./FiltroPeriodoAvancado";
import { GraficoEvolucao } from "./GraficoEvolucao";
import { GraficoRanking } from "./GraficoRanking";
import { TabelaLucros } from "./TabelaLucros";
import { AnalistaFinanceiro } from "./AnalistaFinanceiro";
import { DetalhesCardLucros } from "./DetalhesCardLucros";
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

  const [filtros, setFiltros] = useState<FiltrosPeriodo>({ dataInicio: "", dataFim: "" });
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [lucros, setLucros] = useState<LucroPorItem[]>([]);
  const [evolucao, setEvolucao] = useState<EvolucaoMensal[]>([]);
  const [resumo, setResumo] = useState<ResumoFinanceiro>(resumoVazio);
  const [secaoLucroItem, setSecaoLucroItem] = useState(false);
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
      ]);

      setLucros(lucrosData);
      setEvolucao(evolucaoData);
      setResumo(resumoData);
    },
    [calcularLucroPorItem, calcularEvolucaoMensal, calcularResumo]
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

  if (isFuncionario) return null;

  return (
    <div className="border-t pt-6 space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Análise de Lucros e Custos</h2>
        <p className="text-muted-foreground text-sm">
          Métricas de desempenho financeiro da empresa
        </p>
      </div>

      <FiltroPeriodoAvancado
        onFiltrar={handleFiltrar}
        loading={loading}
        showTipoFiltro
        tipoFiltro={tipoFiltro}
        onTipoFiltroChange={handleTipoChange}
      />

      {/* Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <CardFinanceiroClicavel
          titulo="Total Faturado"
          valor={resumo.receitaTotal}
          subtitulo="Receita total"
          icon={DollarSign}
          valorColor="text-green-600"
          ativo={cardAtivo === "faturado"}
          onClick={() => toggleCard("faturado")}
        />
        {podeVerCustos ? (
          <CardFinanceiroClicavel
            titulo="Custo Total"
            valor={resumo.custoTotal}
            subtitulo="Custo dos produtos"
            icon={TrendingDown}
            valorColor="text-destructive"
            ativo={cardAtivo === "custo_total"}
            onClick={() => toggleCard("custo_total")}
          />
        ) : (
          <CardComLock titulo="Custo Total" icon={TrendingDown} />
        )}
        {podeVerCustos ? (
          <CardFinanceiroClicavel
            titulo="Custo Operacional"
            valor={resumo.custoOperacional}
            subtitulo="Contas pagas no período"
            icon={Receipt}
            iconColor="text-orange-600"
            valorColor="text-orange-600"
            ativo={cardAtivo === "custo_operacional"}
            onClick={() => toggleCard("custo_operacional")}
          />
        ) : (
          <CardComLock titulo="Custo Operacional" icon={Receipt} />
        )}
        {podeVerLucros ? (
          <CardFinanceiroClicavel
            titulo="Lucro Bruto"
            valor={resumo.lucroTotal}
            subtitulo="Receita - custo"
            icon={TrendingUp}
            ativo={cardAtivo === "lucro_bruto"}
            onClick={() => toggleCard("lucro_bruto")}
          />
        ) : (
          <CardComLock titulo="Lucro Bruto" icon={TrendingUp} />
        )}
        {podeVerLucros ? (
          <CardFinanceiroClicavel
            titulo="Lucro Líquido"
            valor={resumo.lucroLiquido}
            subtitulo="Bruto - despesas"
            icon={Wallet}
            valorColor={resumo.lucroLiquido >= 0 ? "text-green-600" : "text-destructive"}
            ativo={cardAtivo === "lucro_liquido"}
            onClick={() => toggleCard("lucro_liquido")}
          />
        ) : (
          <CardComLock titulo="Lucro Líquido" icon={Wallet} />
        )}
        {podeVerLucros ? (
          <CardFinanceiroClicavel
            titulo="Margem de Lucro"
            valor={resumo.margemLucroMedia}
            subtitulo="Média do período"
            icon={Percent}
            tipo="percentual"
            ativo={cardAtivo === "margem"}
            onClick={() => toggleCard("margem")}
          />
        ) : (
          <CardComLock titulo="Margem de Lucro" icon={Percent} />
        )}
        {podeVerCustos ? (
          <CardFinanceiroClicavel
            titulo="Taxas de Cartão"
            valor={resumo.taxasCartao}
            subtitulo="Taxas de máquinas"
            icon={CreditCard}
            iconColor="text-purple-600"
            valorColor="text-purple-600"
            ativo={cardAtivo === "taxas_cartao"}
            onClick={() => toggleCard("taxas_cartao")}
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
      <GraficoEvolucao dados={evolucao} />
      <GraficoRanking itens={lucros} />

      {/* Análise de Lucro por Item */}
      <Collapsible open={secaoLucroItem} onOpenChange={setSecaoLucroItem}>
        <Card>
          <CardHeader>
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 w-full text-left">
                {secaoLucroItem ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <CardTitle>Análise de Lucro por Item</CardTitle>
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

      {/* Analista Financeiro IA */}
      <AnalistaFinanceiro resumo={resumo} lucros={lucros} evolucao={evolucao} />
    </div>
  );
}

// Card com ícone de bloqueio
function CardComLock({ titulo, icon: Icon }: { titulo: string; icon: any }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{titulo}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Lock className="h-5 w-5" />
          <span className="text-sm">Sem permissão</span>
        </div>
      </CardContent>
    </Card>
  );
}
