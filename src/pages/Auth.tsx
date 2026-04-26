import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Phone, Eye, EyeOff } from "lucide-react";
import { aplicarMascaraTelefone, removerMascara } from "@/lib/mascaras";
import { trackCompleteRegistration } from "@/lib/tracking";
import { useEventTracking } from "@/hooks/useEventTracking";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import logoMec from "@/assets/logo-mec-auth.png";

const Auth = () => {
  const { trackLogin } = useEventTracking();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [nome, setNome] = useState("");
  const [celular, setCelular] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || 'dashboard';
  const planKey = searchParams.get('plan') || 'intermediario_mensal';

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'https://www.appmec.in/auth/callback',
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível entrar com o Google. Tente novamente.",
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        await trackLogin();

        toast({
          title: "Login realizado com sucesso",
          description: "Bem-vindo ao Méc",
        });

        if (redirectTo === "onboarding-inicial") {
          navigate(`/video-boas-vindas`);
        } else if (redirectTo.startsWith("/")) {
          navigate(redirectTo);
        } else {
          navigate(`/${redirectTo}`);
        }
      } else {
        if (!nome.trim()) {
          toast({
            variant: "destructive",
            title: "Erro",
            description: "O nome é obrigatório",
          });
          setLoading(false);
          return;
        }

        if (!celular.trim()) {
          toast({
            variant: "destructive",
            title: "Erro",
            description: "O número de celular é obrigatório",
          });
          setLoading(false);
          return;
        }

        const celularNumeros = removerMascara(celular);
        if (celularNumeros.length < 10 || celularNumeros.length > 11) {
          toast({
            variant: "destructive",
            title: "Erro",
            description: "Digite um número de celular válido com DDD",
          });
          setLoading(false);
          return;
        }

        const senha = password.trim();
        const temLetra = /[a-zA-Z]/.test(senha);
        const temNumero = /\d/.test(senha);
        if (senha.length < 8 || !temLetra || !temNumero) {
          toast({
            variant: "destructive",
            title: "Senha muito fraca",
            description: "Use no mínimo 8 caracteres, com letras e números.",
          });
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: {
            data: {
              nome: nome,
              celular: celularNumeros,
            },
            emailRedirectTo: `${window.location.origin}/video-boas-vindas`,
          },
        });

        if (error) throw error;

        if (data?.user) {
          setTimeout(() => {
            trackCompleteRegistration(data.user.id, email);
          }, 1500);

          supabase.functions.invoke('webhook-n8n-cadastro', {
            body: { nome: nome, telefone: celularNumeros, user_id: data.user!.id },
          }).then(({ error: webhookError }) => {
            if (webhookError) console.error('[n8n webhook] Erro:', webhookError);
            else console.log('[n8n webhook] Dados enviados com sucesso');
          }).catch((webhookErr) => {
            console.error('[n8n webhook] Erro:', webhookErr);
          });
        }

        toast({
          title: "Conta criada com sucesso!",
          description: "Bem-vindo ao Méc! Seu teste gratuito já está ativo.",
        });

        setTimeout(() => {
          window.location.href = '/video-boas-vindas';
        }, 500);
      }
    } catch (error: any) {
      if (isLogin) {
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Email ou senha incorretos. Verifique suas credenciais.",
        });
        return;
      }

      if (error?.code === "weak_password") {
        toast({
          variant: "destructive",
          title: "Senha muito fraca",
          description:
            "Escolha uma senha mais forte (evite senhas comuns). Ex: 12+ caracteres e misture letras, números e símbolos.",
        });
        return;
      }

      toast({
        variant: "destructive",
        title: "Erro",
        description:
          "Não foi possível criar a conta. Verifique email e senha e tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resetEmail || !resetEmail.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Digite seu email para redefinir a senha.",
      });
      return;
    }
    
    setResetLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: 'https://www.appmec.in/auth/callback',
      });

      if (error) {
        console.error("Reset password error:", error);
        if (error.message?.includes('rate') || error.status === 429) {
          toast({
            variant: "destructive",
            title: "Aguarde",
            description: "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.",
          });
          return;
        }
      }

      toast({
        title: "Verifique seu email",
        description: "Se este email estiver cadastrado, você receberá um link para redefinir sua senha. Verifique também a pasta de spam.",
      });
    } catch (error) {
      console.error("Reset password error:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Ocorreu um erro ao processar sua solicitação. Tente novamente.",
      });
    } finally {
      setResetDialogOpen(false);
      setResetEmail("");
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
      {/* Background grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
      
      {/* Glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
      
      <Card className="relative w-full max-w-md p-8 space-y-6 bg-slate-900/80 border border-white/10 backdrop-blur-xl shadow-[0_0_60px_-15px_rgba(59,130,246,0.3)]">
        {/* Card glow effect */}
        <div className="absolute -inset-0.5 bg-gradient-to-b from-blue-500/20 via-transparent to-violet-500/10 rounded-lg blur-sm -z-10" />
        
        <div className="flex flex-col items-center space-y-2">
          <img src={logoMec} alt="Méc" className="h-32" />
          <p className="text-sm text-slate-400">
            {isLogin ? "Entre na sua conta" : "Crie sua conta"}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && (
            <>
              <div className="space-y-2">
                <Label htmlFor="nome" className="text-slate-300">Nome completo</Label>
                <Input
                  id="nome"
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required={!isLogin}
                  placeholder="Digite seu nome"
                  className="h-11 bg-slate-800/50 border-white/10 text-white placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-blue-500/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="celular" className="flex items-center gap-1 text-slate-300">
                  <Phone className="h-3.5 w-3.5" />
                  Celular (WhatsApp)
                </Label>
                <Input
                  id="celular"
                  type="tel"
                  value={celular}
                  onChange={(e) => setCelular(aplicarMascaraTelefone(e.target.value))}
                  required={!isLogin}
                  placeholder="(11) 99999-9999"
                  className="h-11 bg-slate-800/50 border-white/10 text-white placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-blue-500/20"
                  maxLength={15}
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-300">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="seu@email.com"
              className="h-11 bg-slate-800/50 border-white/10 text-white placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-blue-500/20"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-300">Senha</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="h-11 bg-slate-800/50 border-white/10 text-white placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-blue-500/20 pr-11"
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-11 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white border-0 shadow-[0_0_20px_-5px_rgba(59,130,246,0.5)] hover:shadow-[0_0_30px_-5px_rgba(59,130,246,0.7)] transition-all duration-300"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Carregando...
              </>
            ) : (
              isLogin ? "Entrar" : "Criar conta"
            )}
          </Button>
        </form>

        <div className="text-center space-y-2">
          {isLogin && (
            <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="text-sm text-slate-500 hover:text-blue-400 transition-colors"
                >
                  Esqueceu a senha?
                </button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-white/10 text-white">
                <DialogHeader>
                  <DialogTitle className="text-white">Redefinir Senha</DialogTitle>
                  <DialogDescription className="text-slate-400">
                    Digite seu email para receber um link de redefinição de senha
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email" className="text-slate-300">Email</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                      placeholder="seu@email.com"
                      className="h-11 bg-slate-800/50 border-white/10 text-white placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-blue-500/20"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white border-0 shadow-[0_0_20px_-5px_rgba(59,130,246,0.5)]"
                    disabled={resetLoading}
                  >
                    {resetLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      "Enviar Link"
                    )}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
          
          <div>
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              {isLogin ? "Não tem uma conta? " : "Já tem uma conta? "}
              <span className="text-blue-400 hover:text-blue-300">
                {isLogin ? "Cadastre-se" : "Entre"}
              </span>
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Auth;
