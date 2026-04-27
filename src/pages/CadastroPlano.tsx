import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Shield, Check, ArrowRight, Phone, CreditCard, QrCode, ChevronRight, ShieldCheck, Lock, CheckCircle2, Zap, Sparkles } from "lucide-react";
import { PLANOS } from "@/types/plano";
import { trackCompleteRegistration } from "@/lib/tracking";
import { useEventTracking } from "@/hooks/useEventTracking";
import { aplicarMascaraTelefone, removerMascara } from "@/lib/mascaras";
import { CartaoCheckoutDialog } from "@/components/planos/CartaoCheckoutDialog";
import { PixCheckoutDialog } from "@/components/planos/PixCheckoutDialog";
import { Badge } from "@/components/ui/badge";
import logoMec from "@/assets/logo-mec-auth.png";

export default function CadastroPlano() {
  const { trackLogin } = useEventTracking();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const planoKey = searchParams.get("plan") || "intermediario_mensal";
  const planoInfo = PLANOS[planoKey] || PLANOS.intermediario_mensal;

  const [step, setStep] = useState<"cadastro" | "checkout">("cadastro");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [abrirCartao, setAbrirCartao] = useState(false);
  const [abrirPix, setAbrirPix] = useState(false);
  
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [celular, setCelular] = useState("");
  const [senha, setSenha] = useState("");

  // Check if user is already logged in
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // User is already logged in, go directly to checkout step
        setIsExistingUser(true);
        setStep("checkout");
      }
      setCheckingSession(false);
    };
    checkSession();
  }, []);

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const celularNumeros = removerMascara(celular);
      if (celularNumeros.length < 10 || celularNumeros.length > 11) {
        toast.error("Informe um celular válido com DDD para concluir o cadastro.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { nome, celular: celularNumeros }
        }
      });

      if (error) {
        if (error.message.includes("already registered")) {
          toast.error("Este email já está cadastrado. Faça login para continuar.");
          return;
        }
        throw error;
      }

      if (data.user) {
        // Se não há sessão (confirmação de email habilitada), fazer login manual
        if (!data.session) {
          const { error: loginError } = await supabase.auth.signInWithPassword({
            email,
            password: senha,
          });
          if (loginError) {
            // Sessão não disponível ainda, mas conta foi criada — continua para checkout
            console.warn('[CadastroPlano] Login automático falhou:', loginError.message);
          }
        }

        // Aguardar profile ser criado pelo trigger e disparar CompleteRegistration
        setTimeout(() => {
          trackCompleteRegistration(data.user.id, email);
        }, 1500);

        // Fire-and-forget para não travar o cadastro
        supabase.functions.invoke('webhook-n8n-cadastro', {
          body: { nome, telefone: celularNumeros, user_id: data.user.id },
        }).then(({ error: webhookError }) => {
          if (webhookError) console.error('[n8n webhook] Erro:', webhookError);
          else console.log('[n8n webhook] Dados enviados com sucesso');
        }).catch((webhookErr) => {
          console.error('[n8n webhook] Erro:', webhookErr);
        });

        toast.success("Conta criada com sucesso!");
        setStep("checkout");
      }
    } catch (error: any) {
      console.error("Erro ao criar conta:", error);
      toast.error(error.message || "Erro ao criar conta. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: senha
      });

      if (error) throw error;

      // Registrar evento de login (atualiza last_login_at e login_count)
      await trackLogin();
      
      toast.success("Login realizado com sucesso!");
      setStep("checkout");
    } catch (error: any) {
      console.error("Erro ao fazer login:", error);
      toast.error(error.message || "Email ou senha incorretos.");
    } finally {
      setLoading(false);
    }
  };

  const trackInitiateCheckout = () => {
    if (typeof window !== "undefined" && (window as any).fbq) {
      (window as any).fbq("track", "InitiateCheckout", {
        content_name: planoInfo.nome,
        content_category: "subscription",
        currency: "BRL",
        value: planoInfo.preco,
      });
    }
  };

  const garantirSessaoEntao = async (callback: () => void) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Sua sessão expirou. Por favor, faça login novamente.");
      setStep("cadastro");
      return;
    }
    trackInitiateCheckout();
    callback();
  };

  const escolherCartao = () => garantirSessaoEntao(() => setAbrirCartao(true));
  const escolherPix = () => garantirSessaoEntao(() => setAbrirPix(true));

  const onPagamentoConcluido = () => {
    setAbrirCartao(false);
    setAbrirPix(false);
    navigate("/plano");
  };

  const [isLogin, setIsLogin] = useState(false);

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
      {/* Background grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
      
      {/* Glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />

      <div className="relative w-full max-w-md space-y-6">
        {step === "cadastro" ? (
          <Card className="relative p-8 bg-slate-900/80 border border-white/10 backdrop-blur-xl shadow-[0_0_60px_-15px_rgba(59,130,246,0.3)]">
            {/* Card glow effect */}
            <div className="absolute -inset-0.5 bg-gradient-to-b from-blue-500/20 via-transparent to-violet-500/10 rounded-lg blur-sm -z-10" />
            
            <div className="flex flex-col items-center space-y-2 mb-8">
              <img src={logoMec} alt="Méc" className="h-32" />
              <h1 className="text-2xl font-bold text-white">
                {isLogin ? "Bem-vindo de volta!" : "Crie sua conta agora"}
              </h1>
              <p className="text-sm text-slate-400">
                {isLogin 
                  ? "Entre para continuar com sua assinatura" 
                  : "Cadastre-se para assinar o " + planoInfo.nome
                }
              </p>
            </div>

            <form onSubmit={isLogin ? handleLogin : handleCadastro} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="nome" className="text-slate-300">Nome completo</Label>
                  <Input
                    id="nome"
                    type="text"
                    placeholder="Seu nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required={!isLogin}
                    disabled={loading}
                    className="h-11 bg-slate-800/50 border-white/10 text-white placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-blue-500/20"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11 bg-slate-800/50 border-white/10 text-white placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-blue-500/20"
                />
              </div>

              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="celular" className="flex items-center gap-1 text-slate-300">
                    <Phone className="h-3.5 w-3.5" />
                    Celular (WhatsApp)
                  </Label>
                  <Input
                    id="celular"
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={celular}
                    onChange={(e) => setCelular(aplicarMascaraTelefone(e.target.value))}
                    required={!isLogin}
                    maxLength={15}
                    disabled={loading}
                    className="h-11 bg-slate-800/50 border-white/10 text-white placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-blue-500/20"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="senha" className="text-slate-300">Senha</Label>
                <Input
                  id="senha"
                  type="password"
                  placeholder="Sua senha"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  minLength={6}
                  disabled={loading}
                  className="h-11 bg-slate-800/50 border-white/10 text-white placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-blue-500/20"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white border-0 shadow-[0_0_20px_-5px_rgba(59,130,246,0.5)] hover:shadow-[0_0_30px_-5px_rgba(59,130,246,0.7)] transition-all duration-300"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    {isLogin ? "Entrar e Continuar" : "Criar Conta e Continuar"}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
              >
                {isLogin ? "Não tem conta? " : "Já tem uma conta? "}
                <span className="text-blue-400 hover:text-blue-300">
                  {isLogin ? "Cadastre-se" : "Entrar"}
                </span>
              </button>
            </div>

            {/* Plan info */}
            <div className="mt-6 pt-6 border-t border-white/10">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Plano selecionado:</span>
                <span className="font-medium text-white">{planoInfo.nome}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-slate-500">Valor:</span>
                <span className="font-bold text-blue-400">
                  R$ {planoInfo.preco.toFixed(2).replace('.', ',')}{planoInfo.periodo}
                </span>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="relative p-8 bg-slate-900/80 border border-white/10 backdrop-blur-xl shadow-[0_0_60px_-15px_rgba(59,130,246,0.3)]">
            {/* Card glow effect */}
            <div className="absolute -inset-0.5 bg-gradient-to-b from-blue-500/20 via-transparent to-violet-500/10 rounded-lg blur-sm -z-10" />
            
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-green-400" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">
                {isExistingUser ? "Você já está logado!" : "Conta pronta!"}
              </h1>
              <p className="text-slate-400">
                Finalize sua assinatura para começar a usar o sistema.
              </p>
            </div>

            {/* Plan summary */}
            <div className="border border-white/10 rounded-xl p-4 mb-6 bg-slate-800/30">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Plano:</span>
                <span className="font-semibold text-white">{planoInfo.nome}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-slate-400 text-sm">Valor:</span>
                <span className="font-bold text-blue-400">
                  R$ {planoInfo.preco.toFixed(2).replace('.', ',')}{planoInfo.periodo}
                </span>
              </div>
            </div>

            {/* Escolha de método de pagamento - Pagar.me */}
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Badge className="bg-green-500/15 text-green-300 border border-green-500/30 hover:bg-green-500/20">
                  <ShieldCheck className="h-3 w-3 mr-1" />
                  Checkout Seguro
                </Badge>
              </div>

              <button
                type="button"
                onClick={escolherCartao}
                className="group w-full text-left rounded-xl border border-white/10 bg-slate-800/40 p-4 hover:bg-slate-800/70 hover:border-blue-500/50 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white shadow-lg">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">Cartão de Crédito</span>
                      <Badge className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/20">
                        <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                        RECOMENDADO
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">Renovação automática · Ativação imediata</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                </div>
              </button>

              <button
                type="button"
                onClick={escolherPix}
                className="group w-full text-left rounded-xl border border-white/10 bg-slate-800/40 p-4 hover:bg-slate-800/70 hover:border-emerald-500/50 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-lg">
                    <QrCode className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">Pix</span>
                      <Badge className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20">
                        <Zap className="h-2.5 w-2.5 mr-0.5" />
                        INSTANTÂNEO
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">Aprovação em segundos · Sem cadastro de cartão</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                </div>
              </button>

              <ul className="space-y-1.5 pt-3">
                <li className="flex items-center gap-2 text-xs text-slate-400">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
                  <span>Ativação imediata após confirmação</span>
                </li>
                <li className="flex items-center gap-2 text-xs text-slate-400">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
                  <span>Cancele quando quiser, sem fidelidade</span>
                </li>
                <li className="flex items-center gap-2 text-xs text-slate-400">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
                  <span>Pagamento processado por Pagar.me (Stone)</span>
                </li>
              </ul>
            </div>

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-center gap-3 text-[10px] text-slate-500">
              <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> SSL 256-bits</span>
              <span>·</span>
              <span>PCI DSS</span>
              <span>·</span>
              <span>LGPD</span>
            </div>
          </Card>
        )}

        {/* Back to landing */}
        <div className="text-center">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            ← Voltar para a página inicial
          </button>
        </div>
      </div>

      <CartaoCheckoutDialog
        open={abrirCartao}
        onOpenChange={setAbrirCartao}
        planoKey={planoKey}
        planoNome={planoInfo.nome}
        planoPreco={planoInfo.preco}
        onSuccess={onPagamentoConcluido}
      />
      <PixCheckoutDialog
        open={abrirPix}
        onOpenChange={setAbrirPix}
        planoKey={planoKey}
        planoNome={planoInfo.nome}
        planoPreco={planoInfo.preco}
        onSuccess={onPagamentoConcluido}
      />
    </div>
  );
}
