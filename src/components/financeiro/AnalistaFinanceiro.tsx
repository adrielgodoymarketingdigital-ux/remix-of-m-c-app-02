import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ResumoFinanceiro, LucroPorItem, EvolucaoMensal } from "@/types/relatorio";
import { useToast } from "@/hooks/use-toast";

interface AnalistaFinanceiroProps {
  resumo: ResumoFinanceiro;
  lucros: LucroPorItem[];
  evolucao: EvolucaoMensal[];
}

export function AnalistaFinanceiro({ resumo, lucros, evolucao }: AnalistaFinanceiroProps) {
  const [analise, setAnalise] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const gerarAnalise = async () => {
    setLoading(true);
    setAnalise(null);

    try {
      const top5Lucro = [...lucros].sort((a, b) => b.lucroTotal - a.lucroTotal).slice(0, 5);
      const top5Prejuizo = [...lucros].sort((a, b) => a.lucroTotal - b.lucroTotal).slice(0, 5);

      const contexto = {
        resumo,
        top5Lucro: top5Lucro.map((i) => ({
          nome: i.nome,
          receita: i.receitaTotal,
          custo: i.custoTotal,
          lucro: i.lucroTotal,
          margem: i.margemLucro,
          qtd: i.quantidadeVendida,
        })),
        top5Prejuizo: top5Prejuizo.map((i) => ({
          nome: i.nome,
          receita: i.receitaTotal,
          custo: i.custoTotal,
          lucro: i.lucroTotal,
          margem: i.margemLucro,
          qtd: i.quantidadeVendida,
        })),
        evolucaoRecente: evolucao.slice(-6),
      };

      const { data, error } = await supabase.functions.invoke("analista-financeiro", {
        body: { contexto },
      });

      if (error) {
        // Handle rate limit and payment errors
        if (error.message?.includes("429")) {
          toast({
            title: "Limite de requisições",
            description: "Muitas requisições. Tente novamente em alguns segundos.",
            variant: "destructive",
          });
          return;
        }
        if (error.message?.includes("402")) {
          toast({
            title: "Créditos insuficientes",
            description: "Adicione créditos ao seu workspace para usar esta funcionalidade.",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }

      setAnalise(data?.analise || "Não foi possível gerar a análise.");
    } catch (error: any) {
      console.error("Erro ao gerar análise:", error);
      toast({
        title: "Erro ao gerar análise",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Analista Financeiro IA</CardTitle>
          </div>
          <Button onClick={gerarAnalise} disabled={loading} size="sm">
            {loading ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-1" />
            )}
            {loading ? "Analisando..." : "Gerar Análise"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!analise && !loading && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Clique em "Gerar Análise" para receber dicas personalizadas baseadas nos seus dados financeiros.
          </p>
        )}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        {analise && (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {analise.split("\n").map((line, i) => {
              if (!line.trim()) return <br key={i} />;
              if (line.startsWith("##")) {
                return (
                  <h3 key={i} className="text-base font-semibold mt-3 mb-1">
                    {line.replace(/^#+\s*/, "")}
                  </h3>
                );
              }
              if (line.startsWith("- ") || line.startsWith("• ")) {
                return (
                  <p key={i} className="text-sm ml-4 my-0.5">
                    • {line.replace(/^[-•]\s*/, "")}
                  </p>
                );
              }
              return (
                <p key={i} className="text-sm my-1">
                  {line}
                </p>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
