import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useRelatorios } from "@/hooks/useRelatorios";
import { useContas } from "@/hooks/useContas";
import { useCategoriasDespesas } from "@/hooks/useCategoriasDespesas";
import { SecaoContasPagarReceber } from "@/components/financeiro/SecaoContasPagarReceber";
import { SecaoAnaliseLucrosCustos } from "@/components/financeiro/SecaoAnaliseLucrosCustos";
import { ConfiguracoesFinanceiro } from "@/components/financeiro/ConfiguracoesFinanceiro";
import { exportarRelatorioPDF } from "@/lib/exportarPDF";
import { FileDown, CalendarRange } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { useConfetti } from "@/hooks/useConfetti";
import { AppLayout } from "@/components/layout/AppLayout";
import { FiltrosPeriodo } from "@/components/financeiro/FiltroPeriodoAvancado";

export default function Financeiro() {
  const { toast } = useToast();
  const { disparar: dispararConfetti, dispararLados } = useConfetti();
  const jaCompletouLucroRef = useRef(false);
  const {
    loading,
    calcularLucroPorItem,
    calcularEvolucaoMensal,
    calcularResumo,
  } = useRelatorios();

  const { contas, criarConta, atualizarConta, excluirConta, marcarComoPaga } = useContas();
  const { todasCategorias } = useCategoriasDespesas();
  const { config: configLoja } = useConfiguracaoLoja();

  // Track the current filter from the analysis section
  const [filtroAtual, setFiltroAtual] = useState<FiltrosPeriodo>({ dataInicio: "", dataFim: "" });
  const [tipoFiltroAtual, setTipoFiltroAtual] = useState("todos");

  // PDF-specific date filter
  const [pdfDataInicio, setPdfDataInicio] = useState("");
  const [pdfDataFim, setPdfDataFim] = useState("");

  const handleFiltroChange = useCallback((filtro: FiltrosPeriodo, tipo: string) => {
    setFiltroAtual(filtro);
    setTipoFiltroAtual(tipo);
  }, []);

  useEffect(() => {
    verificarOnboarding();
  }, []);

  const verificarOnboarding = async () => {
    if (jaCompletouLucroRef.current) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: onboardingData } = await supabase
        .from('user_onboarding')
        .select('step_lucro_visualizado, onboarding_completed')
        .eq('user_id', user.id)
        .maybeSingle();

      if (onboardingData?.step_lucro_visualizado || onboardingData?.onboarding_completed) {
        return;
      }

      await supabase.rpc('update_onboarding_step', {
        _user_id: user.id,
        _step: 'lucro_visualizado'
      });

      jaCompletouLucroRef.current = true;

      dispararLados();
      setTimeout(() => dispararConfetti('conquista'), 300);

      toast({
        title: "🎉 Parabéns!",
        description: "Você completou todos os passos do onboarding! Explore todas as funcionalidades do sistema.",
      });
    } catch (error) {
      console.error('[Financeiro] Erro ao verificar onboarding:', error);
    }
  };

  const handleExportarPDF = async () => {
    try {
      const filtros = {
        dataInicio: pdfDataInicio || filtroAtual.dataInicio,
        dataFim: pdfDataFim || filtroAtual.dataFim,
        tipo: tipoFiltroAtual as any,
      };

      const resumo = await calcularResumo(filtros);
      const lucros = await calcularLucroPorItem(filtros);

      const formatarData = (d: string) => {
        if (!d) return "início";
        return new Date(d + "T12:00:00").toLocaleDateString("pt-BR");
      };

      await exportarRelatorioPDF(
        resumo,
        lucros,
        formatarData(filtros.dataInicio),
        formatarData(filtros.dataFim),
        configLoja
      );
      toast({
        title: "PDF exportado com sucesso!",
        description: "O relatório foi baixado.",
      });
    } catch (error: any) {
      console.error("Erro ao exportar PDF:", error);
      toast({
        title: "Erro ao exportar PDF",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <AppLayout>
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Financeiro</h1>
              <p className="text-muted-foreground">
                Gestão completa de contas, lucros e custos
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ConfiguracoesFinanceiro />

              {/* PDF Export with date filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="default" disabled={loading}>
                    <FileDown className="h-4 w-4 mr-2" />
                    Exportar PDF
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-sm mb-1 flex items-center gap-2">
                        <CalendarRange className="h-4 w-4" />
                        Período do Relatório
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Deixe em branco para usar o filtro da análise.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Data Início</Label>
                        <Input
                          type="date"
                          value={pdfDataInicio}
                          onChange={(e) => setPdfDataInicio(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Data Fim</Label>
                        <Input
                          type="date"
                          value={pdfDataFim}
                          onChange={(e) => setPdfDataFim(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    </div>
                    {(pdfDataInicio || pdfDataFim) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs w-full"
                        onClick={() => {
                          setPdfDataInicio("");
                          setPdfDataFim("");
                        }}
                      >
                        Limpar datas
                      </Button>
                    )}
                    <Button
                      className="w-full"
                      onClick={handleExportarPDF}
                      disabled={loading}
                    >
                      <FileDown className="h-4 w-4 mr-2" />
                      Gerar PDF
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Seção 1: Contas a Pagar e a Receber */}
          <SecaoContasPagarReceber
            contas={contas}
            onCriarConta={criarConta}
            onAtualizarConta={atualizarConta}
            onExcluirConta={excluirConta}
            onMarcarComoPaga={marcarComoPaga}
            categoriasExtras={todasCategorias()}
          />

          {/* Seção 2: Análise de Lucros e Custos */}
          <SecaoAnaliseLucrosCustos
            loading={loading}
            calcularLucroPorItem={calcularLucroPorItem}
            calcularEvolucaoMensal={calcularEvolucaoMensal}
            calcularResumo={calcularResumo}
            onFiltroChange={handleFiltroChange}
          />
        </div>
      </main>
    </AppLayout>
  );
}
