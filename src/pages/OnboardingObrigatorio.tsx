import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOnboardingObrigatorio } from "@/hooks/useOnboardingObrigatorio";
import { supabase } from "@/integrations/supabase/client";
import { useVerificacaoAcesso } from "@/hooks/useVerificacaoAcesso";
import { ChecklistDispositivo } from "@/components/ordens/ChecklistDispositivo";
import { MarcacaoAvarias } from "@/components/ordens/MarcacaoAvarias";
import { Checklist, AvariaVisual } from "@/types/ordem-servico";
import {
  ClipboardList,
  ArrowRight,
  Loader2,
  Target,
  ListChecks,
  TrendingUp,
  Zap,
  FlaskConical,
  CheckCircle2,
  Plus,
  Settings,
  Eye,
  Sparkles,
} from "lucide-react";

const OBJETIVOS = [
  { id: "organizar_os", label: "Organizar ordens de serviço", icon: ClipboardList },
  { id: "padronizar", label: "Padronizar atendimentos", icon: ListChecks },
  { id: "controle", label: "Ter mais controle da assistência", icon: Target },
  { id: "produtividade", label: "Ganhar produtividade no dia a dia", icon: Zap },
];

const RECOMENDACOES: Record<string, string> = {
  organizar_os: "criar_os",
  padronizar: "ver_os",
  controle: "configurar",
  produtividade: "criar_os",
};

export default function OnboardingObrigatorio() {
  const navigate = useNavigate();
  const { status, isVerificando } = useVerificacaoAcesso();
  const navigatingRef = useRef(false);

  const {
    loading,
    saving,
    progress,
    osTesteResumo,
    saveObjetivo,
    advanceToStep3,
    saveOSTeste,
    advanceToStep5,
    advanceToStep6,
    markOnboardingCompleted,
  } = useOnboardingObrigatorio();

  // Form state passo 3
  const [clienteNome, setClienteNome] = useState("");
  const [clienteTelefone, setClienteTelefone] = useState("");
  const [tipoDispositivo, setTipoDispositivo] = useState("celular");
  const [defeito, setDefeito] = useState("");
  const [checklist, setChecklist] = useState<Checklist>({ entrada: {}, saida: {} });
  const [avarias, setAvarias] = useState<AvariaVisual[]>([]);
  const [servicoNome, setServicoNome] = useState("");
  const [servicoValor, setServicoValor] = useState("");
  const [servicoCusto, setServicoCusto] = useState("");
  const [showChecklist, setShowChecklist] = useState(false);
  const [showAvarias, setShowAvarias] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate('/cadastro-trial');
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    if (!isVerificando && status === "liberado") {
      navigate("/dashboard", { replace: true });
    }
  }, [isVerificando, status, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Só redirecionar automaticamente se NÃO estamos no meio de uma navegação manual
  if (progress.data.onboardingCompleted && !navigatingRef.current) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  const currentStep = progress.currentStep;

  const stepPercent = (() => {
    if (currentStep <= 1) return 0;
    if (currentStep === 2) return 17;
    if (currentStep === 3) return 40;
    if (currentStep === 4) return 60;
    if (currentStep === 5) return 80;
    return 100;
  })();

  const handleSubmitOSTeste = async () => {
    if (!clienteNome || !defeito) return;
    await saveOSTeste({
      clienteNome,
      clienteTelefone,
      tipoDispositivo,
      defeito,
      checklist: Object.keys(checklist.entrada).length > 0 ? checklist : undefined,
      avarias: avarias.length > 0 ? avarias : undefined,
      servicoNome: servicoNome || undefined,
      servicoValor: servicoValor ? parseFloat(servicoValor) : undefined,
      servicoCusto: servicoCusto ? parseFloat(servicoCusto) : undefined,
    });
  };

  const handleFinish = async (destino: string) => {
    navigatingRef.current = true;
    const success = await markOnboardingCompleted();
    if (!success) {
      navigatingRef.current = false;
      return;
    }
    // Limpar cache de verificação para forçar nova verificação com onboarding completo
    try { sessionStorage.removeItem("mec_verificacao_cache"); } catch {}
    // Após onboarding, ir para o guia de instalação do app
    navigate("/instalar-app", { replace: true });
  };

  const lucroServico = (() => {
    const valor = servicoValor ? parseFloat(servicoValor) : 0;
    const custo = servicoCusto ? parseFloat(servicoCusto) : 0;
    return valor - custo;
  })();

  const recomendado = RECOMENDACOES[progress.data.objetivoOnboarding || "organizar_os"] || "criar_os";

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-8 px-4 onboarding-light">
      <div className="max-w-lg mx-auto">
        {/* Progress Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">
              Passo {Math.min(currentStep, 6)} de 6
            </span>
            <span className="text-sm text-primary font-medium">
              {stepPercent}%
            </span>
          </div>
          <Progress value={stepPercent} className="h-2" />
        </div>

        {/* PASSO 1 — Objetivo */}
        {currentStep === 1 && (
          <Card className="border-0 shadow-xl">
            <CardContent className="p-6 sm:p-8">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
                  <Target className="h-7 w-7 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">Qual é seu principal objetivo agora?</h2>
                <p className="text-muted-foreground mt-1">Isso nos ajuda a personalizar sua experiência</p>
              </div>

              <div className="grid gap-3">
                {OBJETIVOS.map((obj) => {
                  const Icon = obj.icon;
                  return (
                    <button
                      key={obj.id}
                      onClick={() => saveObjetivo(obj.id)}
                      disabled={saving}
                      className="flex items-center gap-4 p-4 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-left group"
                    >
                      <div className="p-2.5 rounded-lg bg-primary/10 group-hover:bg-primary/20">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <span className="font-semibold text-sm">{obj.label}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* PASSO 2 — Aviso de teste */}
        {currentStep === 2 && (
          <Card className="border-0 shadow-xl">
            <CardContent className="p-6 sm:p-8">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-4">
                  <FlaskConical className="h-8 w-8 text-emerald-600" />
                </div>
                <h2 className="text-2xl font-bold">🧪 Ordem de Serviço de Teste</h2>
                <p className="text-muted-foreground mt-2">
                  Agora você vai criar uma ordem de serviço de teste para conhecer o sistema.
                </p>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-emerald-800 font-medium">
                    Essa OS <strong>não será contabilizada</strong> no limite do plano gratuito
                  </p>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
                  <span className="text-red-500 mt-0.5 shrink-0 text-lg leading-none">✕</span>
                  <p className="text-sm text-red-800 font-medium">
                    Ela existe <strong>apenas para demonstração</strong>
                  </p>
                </div>
              </div>

              <Button
                onClick={advanceToStep3}
                className="w-full h-12"
              >
                <FlaskConical className="mr-2 h-4 w-4" />
                Criar OS de teste
              </Button>
            </CardContent>
          </Card>
        )}

        {/* PASSO 3 — Cadastro da OS de teste */}
        {currentStep === 3 && (
          <Card className="border-0 shadow-xl">
            <CardContent className="p-6 sm:p-8">
              <div className="text-center mb-4">
                <h2 className="text-xl font-bold">Cadastre uma OS de teste</h2>
                <p className="text-muted-foreground text-sm">Leva menos de 1 minuto</p>
              </div>

              <div className="space-y-4">
                {/* Cliente */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Cliente</h3>
                  <div className="space-y-2">
                    <Label htmlFor="clienteNome">Nome do cliente *</Label>
                    <Input
                      id="clienteNome"
                      placeholder="Ex: João da Silva"
                      value={clienteNome}
                      onChange={(e) => setClienteNome(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clienteTelefone">Telefone</Label>
                    <Input
                      id="clienteTelefone"
                      placeholder="(00) 00000-0000"
                      value={clienteTelefone}
                      onChange={(e) => setClienteTelefone(e.target.value)}
                    />
                  </div>
                </div>

                {/* Dispositivo */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Dispositivo</h3>
                  <div className="space-y-2">
                    <Label>Tipo de dispositivo *</Label>
                    <Select value={tipoDispositivo} onValueChange={setTipoDispositivo}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="celular">Celular</SelectItem>
                        <SelectItem value="tablet">Tablet</SelectItem>
                        <SelectItem value="notebook">Notebook</SelectItem>
                        <SelectItem value="computador">Computador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="defeito">Defeito relatado *</Label>
                    <Textarea
                      id="defeito"
                      placeholder="Ex: Tela quebrada, não liga..."
                      value={defeito}
                      onChange={(e) => setDefeito(e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>

                {/* Checklist toggle */}
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setShowChecklist(!showChecklist)}
                  >
                    <ListChecks className="h-4 w-4 mr-2" />
                    {showChecklist ? "Ocultar checklist" : "Adicionar checklist (opcional)"}
                  </Button>
                  {showChecklist && (
                    <ChecklistDispositivo
                      tipoDispositivo={tipoDispositivo}
                      value={checklist}
                      onChange={setChecklist}
                    />
                  )}
                </div>

                {/* Avarias toggle */}
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setShowAvarias(!showAvarias)}
                  >
                    <Target className="h-4 w-4 mr-2" />
                    {showAvarias ? "Ocultar avarias" : "Marcar avarias (opcional)"}
                  </Button>
                  {showAvarias && (
                    <MarcacaoAvarias
                      tipoDispositivo={tipoDispositivo}
                      value={avarias}
                      onChange={setAvarias}
                    />
                  )}
                </div>

                {/* Serviço */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Serviço</h3>
                  <div className="space-y-2">
                    <Label htmlFor="servicoNome">Descrição</Label>
                    <Input
                      id="servicoNome"
                      placeholder="Ex: Troca de tela"
                      value={servicoNome}
                      onChange={(e) => setServicoNome(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="servicoValor">Valor cobrado (R$)</Label>
                      <Input
                        id="servicoValor"
                        type="number"
                        placeholder="150.00"
                        value={servicoValor}
                        onChange={(e) => setServicoValor(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="servicoCusto">Custo (R$)</Label>
                      <Input
                        id="servicoCusto"
                        type="number"
                        placeholder="80.00"
                        value={servicoCusto}
                        onChange={(e) => setServicoCusto(e.target.value)}
                      />
                    </div>
                  </div>
                  {(servicoValor || servicoCusto) && (
                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-blue-700 font-medium">Lucro estimado:</span>
                        <span className={`font-bold ${lucroServico >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          R$ {lucroServico.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleSubmitOSTeste}
                  disabled={!clienteNome || !defeito || saving}
                  className="w-full h-12 mt-2"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                    <>
                      Salvar OS de teste
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* PASSO 4 — Micro vitória */}
        {currentStep === 4 && osTesteResumo && (
          <Card className="border-0 shadow-xl">
            <CardContent className="p-6 sm:p-8">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-4">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
                <h2 className="text-2xl font-bold">🎉 OS criada com sucesso!</h2>
                <p className="text-muted-foreground mt-2">
                  Pronto. É assim que você organiza suas ordens de serviço no dia a dia.
                </p>
              </div>

              <div className="space-y-3 mb-6">
                <div className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-lg">{osTesteResumo.numero_os}</span>
                    <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                      🧪 OS de teste
                    </Badge>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <p><span className="text-muted-foreground">Cliente:</span> {osTesteResumo.clienteNome}</p>
                    <p><span className="text-muted-foreground">Dispositivo:</span> {osTesteResumo.dispositivo}</p>
                    <p><span className="text-muted-foreground">Defeito:</span> {osTesteResumo.defeito}</p>
                    {osTesteResumo.servico && (
                      <>
                        <p><span className="text-muted-foreground">Serviço:</span> {osTesteResumo.servico.nome} — R$ {osTesteResumo.servico.valor?.toFixed(2)}</p>
                        {osTesteResumo.servico.custo != null && (
                          <p><span className="text-muted-foreground">Lucro:</span> <span className="text-emerald-600 font-medium">R$ {(osTesteResumo.servico.valor - osTesteResumo.servico.custo).toFixed(2)}</span></p>
                        )}
                      </>
                    )}
                    {osTesteResumo.checklist && Object.keys(osTesteResumo.checklist.entrada || {}).length > 0 && (
                      <p className="text-muted-foreground">✅ Checklist preenchido</p>
                    )}
                    {osTesteResumo.avarias && osTesteResumo.avarias.length > 0 && (
                      <p className="text-muted-foreground">📍 {osTesteResumo.avarias.length} avaria(s) marcada(s)</p>
                    )}
                  </div>
                </div>

                <p className="text-sm text-muted-foreground text-center">
                  As próximas OS já serão reais e seguirão os limites do plano gratuito.
                </p>
              </div>

              <Button onClick={advanceToStep5} className="w-full h-12">
                Continuar
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* PASSO 5 — Limite real */}
        {currentStep === 5 && (
          <Card className="border-0 shadow-xl">
            <CardContent className="p-6 sm:p-8">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold">A partir de agora, suas OS serão reais</h2>
                <p className="text-muted-foreground mt-2 text-sm">
                  A OS de teste <strong>não foi contabilizada</strong>.
                </p>
              </div>

              <div className="p-6 rounded-xl bg-muted text-center mb-6">
                <p className="text-4xl font-bold">0 / 5</p>
                <p className="text-muted-foreground text-sm mt-1">OS reais utilizadas este mês</p>
              </div>

              <p className="text-sm text-muted-foreground text-center mb-6">
                No plano Profissional você cria OS ilimitadas e desbloqueia recursos avançados.
              </p>

              <div className="space-y-3">
                <Button onClick={advanceToStep6} className="w-full h-12">
                  Continuar no plano gratuito
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    navigatingRef.current = true;
                    await markOnboardingCompleted();
                    try { sessionStorage.removeItem("mec_verificacao_cache"); } catch {}
                    navigate("/plano", { replace: true });
                  }}
                  className="w-full h-10 text-sm"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Conhecer plano Pro
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* PASSO 6 — Direcionamento final */}
        {currentStep === 6 && (
          <Card className="border-0 shadow-xl">
            <CardContent className="p-6 sm:p-8">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold">Qual será seu próximo passo?</h2>
              </div>

              <div className="space-y-3">
                {[
                  { id: "criar_os", label: "Criar OS real", icon: Plus, desc: "Cadastre sua primeira ordem de serviço real" },
                  { id: "ver_os", label: "Ver ordens de serviço", icon: Eye, desc: "Veja a lista de ordens e explore o sistema" },
                  { id: "configurar", label: "Configurar dados da assistência", icon: Settings, desc: "Complete as informações da sua loja" },
                ].map((opcao) => {
                  const Icon = opcao.icon;
                  const isRecomendado = opcao.id === recomendado;
                  return (
                    <button
                      key={opcao.id}
                      onClick={() => handleFinish(opcao.id)}
                      disabled={saving}
                      className={`flex items-center gap-4 p-4 rounded-xl border-2 w-full text-left transition-all ${
                        isRecomendado
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className={`p-2.5 rounded-lg ${isRecomendado ? "bg-primary/20" : "bg-muted"}`}>
                        <Icon className={`h-5 w-5 ${isRecomendado ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{opcao.label}</span>
                          {isRecomendado && (
                            <Badge variant="default" className="text-[10px] px-1.5 py-0">Recomendado</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{opcao.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
