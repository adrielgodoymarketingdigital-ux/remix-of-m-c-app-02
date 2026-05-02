import { useState, useEffect } from "react";
import { useSearchParams, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Crown, TrendingUp, HardDrive, Loader2, RefreshCw, ArrowUpCircle, ArrowDownCircle, Clock, Sparkles, XCircle, Gift, Shield, Headphones, AlertTriangle, CalendarClock, Info } from "lucide-react";
import { PLANOS } from "@/types/plano";
import { formatCurrency } from "@/lib/formatters";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAssinatura } from "@/hooks/useAssinatura";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { BotoesPagamentoPagarme } from "@/components/planos/BotoesPagamentoPagarme";
import { GerenciarAssinaturaPagarme } from "@/components/planos/GerenciarAssinaturaPagarme";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { APP_BUILD_ID } from "@/lib/build";
import { supabase } from "@/integrations/supabase/client";

export default function Plano() {
  console.log("[Plano] Renderizando - Build:", APP_BUILD_ID);
  
  // Todos os hooks DEVEM vir ANTES de qualquer return condicional
  const { isFuncionario, carregando: carregandoFuncionario } = useFuncionarioPermissoes();
  const [periodoPlano, setPeriodoPlano] = useState<"mensal" | "anual">("mensal");
  const { assinatura, carregando, abrirPaginaPagamento, cancelarPlano, limites, recarregar, obterContagemDispositivos, diasRestantesTrial, horasRestantesTrial, trialExpirado, migracaoNecessaria } = useAssinatura();
  const trialStatus = useTrialStatus();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const [dialogDowngrade, setDialogDowngrade] = useState<{
    open: boolean;
    planoNovo: string;
  }>({ open: false, planoNovo: "" });
  const [polling, setPolling] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [cancelandoTrial, setCancelAndoTrial] = useState(false);
  const highlightPlan = searchParams.get('highlight');
  const [contagemDispositivos, setContagemDispositivos] = useState({
    usados: 0,
    limite: 0,
    restantes: 0,
    percentual: 0
  });
  
  // Polling após checkout success
  useEffect(() => {
    if (searchParams.get("success")) {
      setPolling(true);
      let tentativas = 0;
      const maxTentativas = 15; // 30 segundos (15 x 2s)
      
      const interval = setInterval(async () => {
        await recarregar();
        tentativas++;
        
        // Se assinatura foi atualizada, parar polling
        if (assinatura && assinatura.plano_tipo !== "demonstracao") {
          clearInterval(interval);
          setPolling(false);
          toast({
            title: "✅ Assinatura ativada!",
            description: `Seu plano ${assinatura.plano_tipo.replace(/_/g, " ")} foi ativado com sucesso.`,
          });
          setSearchParams({});
        }
        
        // Timeout após 30s
        if (tentativas >= maxTentativas) {
          clearInterval(interval);
          setPolling(false);
          toast({
            title: "⏳ Processando pagamento",
            description: "Seu pagamento está sendo processado. Clique em 'Atualizar Status' para verificar.",
          });
          setSearchParams({});
        }
      }, 2000);
      
      return () => clearInterval(interval);
    } else if (searchParams.get("canceled")) {
      toast({
        title: "Pagamento cancelado",
        description: "O processo de pagamento foi cancelado.",
        variant: "destructive",
      });
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, assinatura]);

  useEffect(() => {
    if (highlightPlan) {
      const element = document.getElementById(`plan-${highlightPlan}`);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('ring-4', 'ring-primary', 'animate-pulse');
          setTimeout(() => {
            element.classList.remove('animate-pulse');
          }, 2000);
        }, 500);
      }
    }
  }, [highlightPlan]);

  // Carregar contagem de dispositivos
  useEffect(() => {
    const carregarContagem = async () => {
      if (obterContagemDispositivos) {
        const contagem = await obterContagemDispositivos();
        setContagemDispositivos(contagem);
      }
    };
    
    carregarContagem();
    
    // Recarregar a cada 10 segundos
    const interval = setInterval(carregarContagem, 10000);
    return () => clearInterval(interval);
  }, [obterContagemDispositivos, assinatura]);
  
  // Funcionários não podem acessar a página de plano - APÓS todos os hooks
  if (!carregandoFuncionario && isFuncionario) {
    return <Navigate to="/dashboard" replace />;
  }

  // Função para cancelar trial
  const handleCancelarTrial = async () => {
    setCancelAndoTrial(true);
    try {
      const { data, error } = await supabase.functions.invoke('cancel-subscription');
      
      if (error) throw error;
      
      if (data?.success) {
        toast({
          title: "Trial cancelado",
          description: data.message || "Seu trial foi cancelado. Você pode assinar um plano quando quiser.",
        });
        await recarregar();
      } else {
        throw new Error(data?.error || "Erro ao cancelar trial");
      }
    } catch (error: any) {
      console.error("Erro ao cancelar trial:", error);
      toast({
        title: "Erro ao cancelar",
        description: error.message || "Não foi possível cancelar o trial. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setCancelAndoTrial(false);
    }
  };

  const planosFiltrados = Object.entries(PLANOS).filter(([key]) =>
    key.includes(periodoPlano)
  );

  const calcularDescontoAnual = (keyAnual: string) => {
    const keyMensal = keyAnual.replace("_anual", "_mensal");
    const planoMensal = PLANOS[keyMensal];
    const planoAnual = PLANOS[keyAnual];
    
    if (!planoMensal || !planoAnual) return null;
    
    const precoMensalTotal = planoMensal.preco * 12;
    const valorMensalEquivalente = planoAnual.preco / 12;
    const economia = precoMensalTotal - planoAnual.preco;
    const percentualDesconto = (economia / precoMensalTotal) * 100;
    
    return {
      valorMensalEquivalente,
      economia,
      percentualDesconto: Math.round(percentualDesconto * 10) / 10,
    };
  };

  const determinarTipoMudanca = (planoKey: string) => {
    if (!assinatura || assinatura.plano_tipo === "trial") return "upgrade";
    
    const hierarquia = [
      "trial",
      "basico_mensal", "basico_anual",
      "intermediario_mensal", "intermediario_anual",
      "profissional_mensal", "profissional_anual",
      "profissional_ultra_mensal", "profissional_ultra_anual",
    ];

    const nivelAtual = hierarquia.indexOf(assinatura.plano_tipo);
    const nivelNovo = hierarquia.indexOf(planoKey);
    
    if (nivelNovo > nivelAtual) return "upgrade";
    if (nivelNovo < nivelAtual) return "downgrade";
    return "atual";
  };

  const handleSubscribe = async (planoKey: string, cupom?: string) => {
    await abrirPaginaPagamento(planoKey, cupom);
  };

  return (
    <AppLayout>
      <main className="flex-1 p-4 sm:p-6 overflow-auto">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold">Plano do Sistema</h1>
          <p className="text-muted-foreground">Gerencie sua assinatura</p>
        </div>

        <div className="space-y-8">
            {/* Banner de migração de conta Stripe */}
            {(searchParams.get("migration") === "1" || migracaoNecessaria) && (
              <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950/50">
                <Info className="h-5 w-5 text-blue-600" />
                <AlertDescription className="text-blue-800 dark:text-blue-200">
                  <strong className="block mb-1 text-base">🔄 Atualizamos nosso sistema de pagamentos!</strong>
                  Para melhorar sua experiência, migramos nossa plataforma de pagamentos. 
                  Por isso, será necessário <strong>renovar sua assinatura</strong> escolhendo o seu plano abaixo e cadastrando sua forma de pagamento novamente.
                  <br /><br />
                  🔒 <strong>Seus dados estão totalmente seguros!</strong> Clientes, dispositivos, ordens de serviço 
                  e todo o seu histórico continuam intactos — nenhuma informação foi perdida.
                </AlertDescription>
              </Alert>
            )}
            {/* Card de Trial com Cartão Ativo */}
            {trialStatus.isTrialWithCard && trialStatus.isTrialing && !trialStatus.trialExpired && (
              <Card className="p-6 border-2 border-green-500 bg-gradient-to-r from-green-50 to-green-100/50 dark:from-green-950 dark:to-green-900/50">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                    <CalendarClock className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h2 className="text-xl font-bold text-green-800 dark:text-green-200">
                        Período de Teste Ativo
                      </h2>
                      <Badge className="bg-green-600 hover:bg-green-700">
                        {trialStatus.trialDaysRemaining} {trialStatus.trialDaysRemaining === 1 ? 'dia restante' : 'dias restantes'}
                      </Badge>
                    </div>
                    
                    <p className="text-green-700 dark:text-green-300 mb-4">
                      Você está no período de teste gratuito. Após {trialStatus.trialDaysRemaining} dias, seu plano{' '}
                      <strong>{PLANOS[trialStatus.planAfterTrial as keyof typeof PLANOS]?.nome || 'selecionado'}</strong>{' '}
                      será ativado automaticamente por{' '}
                      <strong>{formatCurrency(trialStatus.planPriceAfterTrial)}/mês</strong>.
                    </p>

                    {/* Barra de progresso do trial */}
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-green-600 dark:text-green-400 mb-1">
                        <span>Início do trial</span>
                        <span>Cobrança automática</span>
                      </div>
                      <div className="w-full bg-green-200 dark:bg-green-800 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full transition-all"
                          style={{ width: `${Math.max(0, 100 - (trialStatus.trialDaysRemaining / 7) * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button
                        variant="outline"
                        onClick={() => recarregar()}
                        disabled={carregando || polling}
                        className="border-green-500 text-green-700 hover:bg-green-100"
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Atualizar Status
                      </Button>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                            disabled={cancelandoTrial}
                          >
                            {cancelandoTrial ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Cancelando...
                              </>
                            ) : (
                              <>
                                <XCircle className="mr-2 h-4 w-4" />
                                Cancelar Trial
                              </>
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancelar período de teste?</AlertDialogTitle>
                            <AlertDialogDescription className="space-y-3">
                              <p>
                                Ao cancelar seu trial, você perderá acesso imediato a todas as funcionalidades:
                              </p>
                              <ul className="list-disc pl-5 space-y-1 text-sm">
                                <li>Não poderá mais cadastrar dispositivos, clientes ou vendas</li>
                                <li>Não terá acesso ao PDV, Financeiro e Relatórios</li>
                                <li>Ordens de serviço ficarão indisponíveis</li>
                                <li>Seus dados serão mantidos, mas não poderá acessá-los</li>
                              </ul>
                              <p className="font-semibold text-destructive">
                                Para voltar a usar o sistema, você precisará assinar um plano.
                              </p>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Continuar Trial</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleCancelarTrial}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Confirmar Cancelamento
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              </Card>
            )}


            {/* Alerta de Trial Expirado */}
            {(assinatura?.plano_tipo === 'trial' && trialExpirado) || trialStatus.trialExpired && (
              <Alert className="border-red-500 bg-red-50 dark:bg-red-950">
                <AlertDescription className="text-red-800 dark:text-red-200">
                  ⏰ <strong>Seu período de teste expirou!</strong> Assine agora para continuar usando todas as funções do sistema.
                </AlertDescription>
              </Alert>
            )}

            {/* Alertas de Limite de Dispositivos */}
            {contagemDispositivos.limite !== Infinity && contagemDispositivos.percentual >= 80 && contagemDispositivos.percentual < 100 && (
              <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
                <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                  ⚠️ Você está próximo do limite de dispositivos ({contagemDispositivos.restantes} restantes). 
                  Considere fazer upgrade para um plano superior.
                </AlertDescription>
              </Alert>
            )}

            {contagemDispositivos.limite !== Infinity && contagemDispositivos.percentual >= 100 && (
              <Alert className="border-red-500 bg-red-50 dark:bg-red-950">
                <AlertDescription className="text-red-800 dark:text-red-200">
                  🚫 Você atingiu o limite de {contagemDispositivos.limite} dispositivos. 
                  Faça upgrade para continuar cadastrando.
                </AlertDescription>
              </Alert>
            )}

            {/* Plano Atual */}
            {carregando ? (
              <Card className="p-6">
                <div className="flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              </Card>
            ) : (assinatura && (assinatura.status === "active" || assinatura.status === "trialing" || (trialStatus.isTrialWithCard && trialStatus.isTrialing))) ? (
              <Card className="p-6 border-2 border-primary">
                <div className="flex items-start gap-4">
                  <Crown className="h-8 w-8 text-primary mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h2 className="text-2xl font-bold">Seu Plano Atual</h2>
                      <Badge variant="secondary">
                        {assinatura.plano_tipo.replace(/_/g, " ").toUpperCase()}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                      <div className="flex items-center gap-3">
                        <HardDrive className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Dispositivos</p>
                          <p className="font-semibold">
                            {limites.dispositivos === -1 ? (
                              <span className="flex items-center gap-1">
                                <span>{contagemDispositivos.usados}</span>
                                <span className="text-muted-foreground">/ ∞ Ilimitados</span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <span>{contagemDispositivos.usados}</span>
                                <span className="text-muted-foreground">/ {limites.dispositivos}</span>
                              </span>
                            )}
                          </p>
                          {limites.dispositivos !== -1 && (
                            <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                              <div 
                                className={`h-1.5 rounded-full transition-all ${
                                  contagemDispositivos.percentual >= 90 ? 'bg-red-500' :
                                  contagemDispositivos.percentual >= 70 ? 'bg-yellow-500' :
                                  'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(contagemDispositivos.percentual, 100)}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <TrendingUp className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Armazenamento</p>
                          <p className="font-semibold">
                            {limites.armazenamento_mb >= 1000 
                              ? `${limites.armazenamento_mb / 1000}GB`
                              : `${limites.armazenamento_mb}MB`}
                          </p>
                        </div>
                      </div>
                    </div>
                    {assinatura.plano_tipo === "demonstracao" ? (
                      <Alert className="mt-4">
                        <AlertDescription>
                          Você está no plano de demonstração. Faça upgrade para desbloquear todos os recursos!
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          onClick={() => recarregar()}
                          disabled={carregando || polling}
                        >
                          {polling ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Verificando...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Atualizar Status
                            </>
                          )}
                        </Button>
                        
                        {/* Botão Cancelar Plano - apenas para planos pagos ativos */}
                        {assinatura.plano_tipo !== "trial" &&
                          assinatura.status === "active" &&
                          assinatura.payment_provider !== "pagarme" && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" disabled={cancelando}>
                                {cancelando ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Cancelando...
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Cancelar Plano
                                  </>
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Tem certeza que deseja cancelar?</AlertDialogTitle>
                                <AlertDialogDescription className="space-y-3">
                                  <p>
                                    Ao cancelar seu plano, você perderá acesso imediato a todos os benefícios:
                                  </p>
                                  <ul className="list-disc pl-5 space-y-1 text-sm">
                                    <li>Limite de dispositivos será reduzido para 5</li>
                                    <li>Limite de clientes será reduzido para 10</li>
                                    <li>Limite de ordens de serviço será reduzido para 5</li>
                                    <li>Perda de acesso a módulos Premium</li>
                                    <li>Perda de relatórios avançados</li>
                                    <li>Perda de suporte prioritário</li>
                                  </ul>
                                  <p className="font-semibold text-destructive">
                                    Esta ação é irreversível. Você será movido para o plano de demonstração.
                                  </p>
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Voltar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={async () => {
                                    setCancelando(true);
                                    await cancelarPlano();
                                    setCancelando(false);
                                  }}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Confirmar Cancelamento
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    )}
                    {assinatura.payment_provider === "pagarme" &&
                      assinatura.status === "active" && (
                        <GerenciarAssinaturaPagarme
                          dataProximaCobranca={assinatura.data_proxima_cobranca}
                          onChanged={recarregar}
                        />
                      )}
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="p-6 border-2 border-orange-200 bg-orange-50/50">
                <div className="flex items-start gap-4">
                  {assinatura?.plano_tipo === "demonstracao" && !trialStatus.isTrialWithCard ? (
                    <>
                      <Gift className="h-8 w-8 text-blue-500 mt-1" />
                      <div className="flex-1">
                        <h2 className="text-2xl font-bold mb-2">Ative seu acesso</h2>
                        <p className="text-muted-foreground mb-4">
                          Escolha um plano para começar a usar todas as funcionalidades do sistema!
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-8 w-8 text-orange-500 mt-1" />
                      <div className="flex-1">
                        <h2 className="text-2xl font-bold mb-2">Trial Expirado</h2>
                        <p className="text-muted-foreground mb-4">
                          Seu período de teste gratuito expirou. 
                          Assine um plano para continuar usando o sistema!
                        </p>
                        <Alert>
                          <AlertDescription>
                            <strong>Ação necessária:</strong> Escolha um plano abaixo para continuar usando todas as funcionalidades.
                          </AlertDescription>
                        </Alert>
                      </div>
                    </>
                  )}
                </div>
              </Card>
            )}


            {/* Comparação de Planos */}
            <div>
              <div className="text-center space-y-2 mb-8">
                <h2 className="text-3xl font-bold">Planos Disponíveis</h2>
                <p className="text-muted-foreground max-w-xl mx-auto">
                  Investimento que se paga no primeiro mês. Cancele quando quiser.
                </p>
              </div>
              
              {/* Toggle Switch Mensal/Anual */}
              <div className="flex items-center justify-center gap-4 py-4 mb-8">
                <Label 
                  className={cn(
                    "text-base cursor-pointer transition-colors",
                    periodoPlano === "mensal" ? "font-semibold text-foreground" : "text-muted-foreground"
                  )}
                  onClick={() => setPeriodoPlano("mensal")}
                >
                  Mensal
                </Label>
                <Switch 
                  checked={periodoPlano === "anual"}
                  onCheckedChange={(checked) => setPeriodoPlano(checked ? "anual" : "mensal")}
                  className="data-[state=checked]:bg-primary"
                />
                <Label 
                  className={cn(
                    "text-base cursor-pointer transition-colors flex items-center gap-2",
                    periodoPlano === "anual" ? "font-semibold text-foreground" : "text-muted-foreground"
                  )}
                  onClick={() => setPeriodoPlano("anual")}
                >
                  Anual
                  <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 text-sm font-bold">
                    -20%
                  </span>
                </Label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Card Plano Free - Sempre visível */}
                <Card
                  id="plan-free"
                  className={cn(
                    "p-6 pt-10 relative transition-all duration-300 hover:-translate-y-2 hover:shadow-xl group",
                    assinatura?.plano_tipo === "free" && "border-2 border-primary ring-2 ring-primary/20"
                  )}
                >
                  <div className="absolute top-2 left-4 flex gap-2 z-10">
                    {assinatura?.plano_tipo === "free" && (
                      <Badge variant="secondary">Plano Atual</Badge>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xl font-bold">Plano Free</h3>
                      <p className="text-4xl font-bold mt-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                        {formatCurrency(0)}
                      </p>
                      <p className="text-sm text-muted-foreground">/mês</p>
                    </div>

                    <ul className="space-y-2 mb-4">
                      {PLANOS.free.recursos.map((recurso, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <div className="p-1 rounded-full bg-green-100 dark:bg-green-900 mt-0.5">
                            <Check className="h-3 w-3 text-green-600 dark:text-green-400 flex-shrink-0" />
                          </div>
                          <span>{recurso}</span>
                        </li>
                      ))}
                    </ul>

                    {assinatura?.plano_tipo === "free" ? (
                      <Button className="w-full" disabled>
                        Plano Atual
                      </Button>
                    ) : (
                      <Button variant="outline" className="w-full" disabled>
                        Plano Gratuito
                      </Button>
                    )}
                  </div>
                  
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-primary/80 transition-transform duration-500 origin-left scale-x-0 group-hover:scale-x-100" />
                </Card>
                {planosFiltrados.map(([key, plano]) => {
                  const tipoMudanca = determinarTipoMudanca(key);
                  const planoAtivo = assinatura?.plano_tipo === key && 
                    (assinatura?.status === "active" || assinatura?.status === "trialing");
                  
                  return (
                    <Card
                      id={`plan-${key}`}
                      key={key}
                      className={cn(
                        "p-6 pt-10 relative transition-all duration-300 hover:-translate-y-2 hover:shadow-xl group",
                        plano.popular && "border-2 border-primary shadow-lg md:scale-105",
                        planoAtivo && "border-2 border-primary ring-2 ring-primary/20"
                      )}
                    >
                      {/* Badge Popular */}
                      {plano.popular && (
                        <div className="absolute top-0 right-0 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-4 py-1 text-sm font-bold rounded-bl-xl z-10">
                          Mais Popular
                        </div>
                      )}
                      {/* Badge NOVO */}
                      {plano.novo && (
                        <div className="absolute top-0 right-0 bg-gradient-to-r from-yellow-500 to-amber-400 text-black px-4 py-1 text-sm font-bold rounded-bl-xl z-10">
                          NOVO
                        </div>
                      )}
                      
                      {/* Badges de Status do Plano */}
                      <div className="absolute top-2 left-4 flex gap-2 z-10">
                        {planoAtivo && (
                          <Badge variant="secondary">Plano Atual</Badge>
                        )}
                        {!planoAtivo && tipoMudanca === "upgrade" && (
                          <Badge variant="outline" className="bg-green-50 dark:bg-green-900/50 text-green-700 dark:text-green-400 border-green-200 dark:border-green-700">
                            <ArrowUpCircle className="mr-1 h-3 w-3" />
                            Upgrade
                          </Badge>
                        )}
                        {!planoAtivo && tipoMudanca === "downgrade" && (
                          <Badge variant="outline" className="bg-orange-50 dark:bg-orange-900/50 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-700">
                            <ArrowDownCircle className="mr-1 h-3 w-3" />
                            Downgrade
                          </Badge>
                        )}
                      </div>

                    <div className="space-y-4">
                      <div>
                        <h3 className="text-xl font-bold">{plano.nome}</h3>
                        {plano.descricao && (
                          <p className="text-sm text-muted-foreground mt-0.5">{plano.descricao}</p>
                        )}
                        <p className="text-4xl font-bold mt-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                          {formatCurrency(plano.preco)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {plano.periodo}
                        </p>
                        {periodoPlano === "anual" && (() => {
                          const desconto = calcularDescontoAnual(key);
                          return desconto ? (
                            <div className="mt-2 space-y-1">
                              <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                                {formatCurrency(desconto.valorMensalEquivalente)}/mês
                              </p>
                              <Badge variant="secondary" className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-400">
                                Economize {desconto.percentualDesconto}%
                              </Badge>
                            </div>
                          ) : null;
                        })()}
                      </div>

                      <ul className="space-y-2 mb-4">
                        {plano.recursos.map((recurso, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <div className="p-1 rounded-full bg-green-100 dark:bg-green-900 mt-0.5">
                              <Check className="h-3 w-3 text-green-600 dark:text-green-400 flex-shrink-0" />
                            </div>
                            <span>{recurso}</span>
                          </li>
                        ))}
                      </ul>

                      <BotoesPagamentoPagarme
                        planoKey={key}
                        planoAtual={planoAtivo}
                        popular={plano.popular}
                        carregando={carregando}
                        onSuccess={() => recarregar()}
                      />
                    </div>
                    
                    {/* Linha animada inferior */}
                    <div className={cn(
                      "absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-primary/80 transition-transform duration-500 origin-left",
                      plano.popular ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                    )} />
                  </Card>
                  );
                })}
              </div>

              {/* Seção de Garantias */}
              <div className="grid md:grid-cols-3 gap-4 mt-8">
                <Card className="p-4 flex items-center gap-3 bg-gradient-to-br from-card to-muted/30">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                    <Shield className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-semibold">7 Dias de Garantia</p>
                    <p className="text-sm text-muted-foreground">Ou seu dinheiro de volta</p>
                  </div>
                </Card>
                <Card className="p-4 flex items-center gap-3 bg-gradient-to-br from-card to-muted/30">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                    <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="font-semibold">Ativação Imediata</p>
                    <p className="text-sm text-muted-foreground">Acesso liberado na hora</p>
                  </div>
                </Card>
                <Card className="p-4 flex items-center gap-3 bg-gradient-to-br from-card to-muted/30">
                  <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
                    <Headphones className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="font-semibold">Suporte em Português</p>
                    <p className="text-sm text-muted-foreground">Atendimento humanizado</p>
                  </div>
                </Card>
              </div>
            </div>

            {/* FAQ */}
            <div>
              <h2 className="text-2xl font-bold mb-4">Perguntas Frequentes</h2>
              <Card className="p-6">
                <Accordion type="single" collapsible>
                  <AccordionItem value="item-1">
                    <AccordionTrigger>Como funciona o faturamento?</AccordionTrigger>
                    <AccordionContent>
                      O faturamento é mensal e automático. Você será cobrado no mesmo
                      dia de cada mês a partir da data de contratação do plano.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-2">
                    <AccordionTrigger>
                      Posso mudar de plano a qualquer momento?
                    </AccordionTrigger>
                    <AccordionContent>
                      Sim! Você pode fazer upgrade ou downgrade do seu plano a
                      qualquer momento. As alterações entram em vigor imediatamente e
                      o valor é ajustado proporcionalmente.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-3">
                    <AccordionTrigger>O que acontece se eu cancelar?</AccordionTrigger>
                    <AccordionContent>
                      Você pode cancelar seu plano a qualquer momento. Seus dados
                      ficarão disponíveis até o final do período pago e você pode
                      reativar dentro de 30 dias sem perder informações.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-4">
                    <AccordionTrigger>
                      Há limite de transações nos planos?
                    </AccordionTrigger>
                    <AccordionContent>
                      Não! Todos os planos incluem transações ilimitadas. Os limites
                      aplicam-se apenas ao número de dispositivos cadastrados e
                      usuários simultâneos.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-6">
                    <AccordionTrigger>O que acontece se meu pagamento falhar?</AccordionTrigger>
                    <AccordionContent>
                      Se houver falha no pagamento, seu plano será automaticamente revertido 
                      para o plano de demonstração. Seus dados serão preservados e você pode 
                      reativar sua assinatura a qualquer momento atualizando seu método de pagamento.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-7">
                    <AccordionTrigger>Posso fazer downgrade do meu plano?</AccordionTrigger>
                    <AccordionContent>
                      Sim! Você pode fazer downgrade a qualquer momento. O valor já pago será 
                      creditado proporcionalmente. Note que ao fazer downgrade, você perderá 
                      acesso a recursos do plano superior, mas seus dados permanecerão seguros.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-8">
                    <AccordionTrigger>Como funciona o plano de demonstração?</AccordionTrigger>
                    <AccordionContent>
                      O plano de demonstração permite visualizar a interface do sistema com 
                      dados fictícios. É ideal para conhecer o produto antes de assinar. Para 
                      começar a usar o sistema com seus próprios dados, assine qualquer um dos 
                      nossos planos pagos.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </Card>
            </div>
            
            {/* Build ID discreto para verificação */}
            <div className="text-center mt-8 pb-4">
              <span className="text-xs text-muted-foreground/50">
                Build: {APP_BUILD_ID}
              </span>
            </div>
          </div>
        </main>
      </AppLayout>
    );
  }
