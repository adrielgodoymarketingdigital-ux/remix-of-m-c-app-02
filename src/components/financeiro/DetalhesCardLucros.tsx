import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { LucroPorItem, ResumoFinanceiro } from "@/types/relatorio";
import { Info } from "lucide-react";

type CardAtivoLucros =
  | "faturado"
  | "custo_total"
  | "custo_operacional"
  | "lucro_bruto"
  | "lucro_liquido"
  | "margem"
  | "taxas_cartao";

interface DetalhesCardLucrosProps {
  cardAtivo: CardAtivoLucros;
  lucros: LucroPorItem[];
  resumo: ResumoFinanceiro;
}

const tipoLabels: Record<string, string> = {
  dispositivo: "Dispositivo",
  produto: "Produto",
  servico: "Serviço",
};

const titulosPorCard: Record<CardAtivoLucros, string> = {
  faturado: "Detalhes do Faturamento",
  custo_total: "Detalhes dos Custos",
  custo_operacional: "Detalhes do Custo Operacional",
  lucro_bruto: "Detalhes do Lucro Bruto",
  lucro_liquido: "Detalhes do Lucro Líquido",
  margem: "Detalhes da Margem de Lucro",
  taxas_cartao: "Detalhes das Taxas de Cartão",
};

export function DetalhesCardLucros({ cardAtivo, lucros, resumo }: DetalhesCardLucrosProps) {
  const itensOrdenados = useMemo(() => {
    const sorted = [...lucros];
    switch (cardAtivo) {
      case "faturado":
        return sorted.sort((a, b) => b.receitaTotal - a.receitaTotal);
      case "custo_total":
        return sorted.sort((a, b) => b.custoTotal - a.custoTotal);
      case "lucro_bruto":
      case "lucro_liquido":
        return sorted.sort((a, b) => b.lucroTotal - a.lucroTotal);
      case "margem":
        return sorted.sort((a, b) => b.margemLucro - a.margemLucro);
      default:
        return sorted;
    }
  }, [lucros, cardAtivo]);

  const contasPagasAgrupadas = useMemo(() => {
    const detalhes = resumo.contasPagasDetalhes || [];
    const categoriaMap = new Map<string, { categoria: string; total: number; quantidade: number; contas: typeof detalhes }>();

    detalhes.forEach((conta) => {
      const cat = conta.categoria || "Sem categoria";
      if (!categoriaMap.has(cat)) {
        categoriaMap.set(cat, { categoria: cat, total: 0, quantidade: 0, contas: [] });
      }
      const grupo = categoriaMap.get(cat)!;
      grupo.total += conta.valor;
      grupo.quantidade += 1;
      grupo.contas.push(conta);
    });

    return Array.from(categoriaMap.values()).sort((a, b) => b.total - a.total);
  }, [resumo.contasPagasDetalhes]);

  const renderResumoOperacional = () => {
    const detalhes = resumo.contasPagasDetalhes || [];

    return (
      <div className="space-y-4">
        {/* Legenda explicativa */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">O que é o Custo Operacional?</p>
            <p>
              São todas as <strong>contas a pagar já quitadas (pagas)</strong> no período selecionado, 
              excluindo custos de peças/produtos de OS e taxas de cartão (que já são contabilizados no Custo Total).
              Inclui despesas como aluguel, contas de consumo, salários, e qualquer 
              outro lançamento do tipo "a pagar" que já foi marcado como pago.
            </p>
            <p>
              Este valor é descontado do <strong>Lucro Bruto</strong> para calcular o <strong>Lucro Líquido</strong>.
            </p>
          </div>
        </div>

        {/* Resumo total */}
        <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
          <div>
            <p className="font-medium text-sm">Total do Custo Operacional</p>
            <p className="text-xs text-muted-foreground">
              {detalhes.length} conta(s) paga(s) no período
            </p>
          </div>
          <span className="font-semibold text-orange-600">
            <ValorMonetario valor={resumo.custoOperacional} />
          </span>
        </div>

        {/* Agrupado por categoria */}
        {contasPagasAgrupadas.length > 0 ? (
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Detalhamento por categoria
            </p>
            {contasPagasAgrupadas.map((grupo) => (
              <div key={grupo.categoria} className="space-y-1">
                <div className="flex items-center justify-between p-2.5 rounded-lg border bg-card">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {grupo.categoria}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      ({grupo.quantidade} conta{grupo.quantidade > 1 ? "s" : ""})
                    </span>
                  </div>
                  <span className="font-semibold text-sm text-orange-600">
                    <ValorMonetario valor={grupo.total} />
                  </span>
                </div>
                {/* Itens individuais da categoria */}
                <div className="ml-4 space-y-1">
                  {grupo.contas.map((conta) => (
                    <div
                      key={conta.id}
                      className="flex items-center justify-between py-1.5 px-2 text-xs rounded bg-muted/30"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate">{conta.nome}</span>
                        <span className="text-muted-foreground shrink-0">
                          {new Date(conta.data + "T12:00:00").toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      <span className="font-medium text-orange-600 shrink-0 ml-2">
                        <ValorMonetario valor={conta.valor} />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center py-4 text-muted-foreground text-sm">
            Nenhuma conta paga encontrada no período selecionado.
          </p>
        )}
      </div>
    );
  };

  const renderResumoLiquidoInfo = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-lg border bg-card text-center">
          <p className="text-xs text-muted-foreground">Lucro Bruto</p>
          <p className="font-semibold text-sm">
            <ValorMonetario valor={resumo.lucroTotal} />
          </p>
        </div>
        <div className="p-3 rounded-lg border bg-card text-center">
          <p className="text-xs text-muted-foreground">(-) Custo Operacional</p>
          <p className="font-semibold text-sm text-orange-600">
            <ValorMonetario valor={resumo.custoOperacional} />
          </p>
        </div>
        <div className="p-3 rounded-lg border bg-card text-center">
          <p className="text-xs text-muted-foreground">(=) Lucro Líquido</p>
          <p className={`font-semibold text-sm ${resumo.lucroLiquido >= 0 ? "text-green-600" : "text-destructive"}`}>
            <ValorMonetario valor={resumo.lucroLiquido} />
          </p>
        </div>
      </div>
    </div>
  );

  const renderTaxasCartao = () => {
    const detalhes = resumo.taxasCartaoDetalhes || [];

    return (
      <div className="space-y-4">
        {/* Legenda explicativa */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">O que são as Taxas de Cartão?</p>
            <p>
              São as taxas cobradas pelas <strong>máquinas de cartão (maquininhas)</strong> sobre cada venda 
              realizada com pagamento em cartão de crédito ou débito. Elas são lançadas automaticamente 
              com base na bandeira e percentual configurados.
            </p>
          </div>
        </div>

        {/* Resumo total */}
        <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
          <div>
            <p className="font-medium text-sm">Total de Taxas de Cartão</p>
            <p className="text-xs text-muted-foreground">
              {detalhes.length} taxa(s) no período
            </p>
          </div>
          <span className="font-semibold text-purple-600">
            <ValorMonetario valor={resumo.taxasCartao} />
          </span>
        </div>

        {/* Lista de taxas com bandeira */}
        {detalhes.length > 0 ? (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Detalhamento por transação
            </p>
            {detalhes.map((taxa) => (
              <div
                key={taxa.id}
                className="flex items-center justify-between py-2 px-3 text-sm rounded-lg border bg-card"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {taxa.bandeira}
                  </Badge>
                  <span className="text-xs text-muted-foreground truncate">
                    {taxa.descricao || taxa.nome}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(taxa.data + "T12:00:00").toLocaleDateString("pt-BR")}
                  </span>
                </div>
                <span className="font-medium text-purple-600 shrink-0 ml-2">
                  <ValorMonetario valor={taxa.valor} />
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center py-4 text-muted-foreground text-sm">
            Nenhuma taxa de cartão encontrada no período selecionado.
          </p>
        )}
      </div>
    );
  };

  const renderItens = () => {
    if (itensOrdenados.length === 0) {
      return (
        <p className="text-center py-4 text-muted-foreground">
          Nenhum item encontrado no período
        </p>
      );
    }

    return (
      <div className="space-y-2">
        {itensOrdenados.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-3 rounded-lg border bg-card"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm truncate">{item.nome}</p>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {tipoLabels[item.tipo] || item.tipo}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {item.quantidadeVendida} vendido(s)
                {cardAtivo === "margem" && ` • Margem: ${item.margemLucro.toFixed(1)}%`}
              </p>
            </div>
            <div className="text-right shrink-0 ml-3">
              {cardAtivo === "faturado" && (
                <span className="font-semibold text-green-600">
                  <ValorMonetario valor={item.receitaTotal} />
                </span>
              )}
              {cardAtivo === "custo_total" && (
                <span className="font-semibold text-destructive">
                  <ValorMonetario valor={item.custoTotal} />
                </span>
              )}
              {(cardAtivo === "lucro_bruto" || cardAtivo === "lucro_liquido") && (
                <span className={`font-semibold ${item.lucroTotal >= 0 ? "text-green-600" : "text-destructive"}`}>
                  <ValorMonetario valor={item.lucroTotal} />
                </span>
              )}
              {cardAtivo === "margem" && (
                <Badge
                  variant="outline"
                  className={
                    item.margemLucro >= 30
                      ? "text-green-600"
                      : item.margemLucro >= 15
                      ? "text-yellow-600"
                      : "text-destructive"
                  }
                >
                  {item.margemLucro.toFixed(1)}%
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{titulosPorCard[cardAtivo]}</CardTitle>
          {cardAtivo !== "custo_operacional" && cardAtivo !== "taxas_cartao" && (
            <Badge variant="secondary">
              {itensOrdenados.length} item(ns)
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {cardAtivo === "custo_operacional" ? renderResumoOperacional() :
         cardAtivo === "taxas_cartao" ? renderTaxasCartao() :
         cardAtivo === "lucro_liquido" ? (
           <div className="space-y-4">
             {renderResumoLiquidoInfo()}
             <hr />
             {renderItens()}
           </div>
         ) : renderItens()}
      </CardContent>
    </Card>
  );
}
