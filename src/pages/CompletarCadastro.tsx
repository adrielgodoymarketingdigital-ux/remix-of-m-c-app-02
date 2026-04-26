import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, AlertCircle, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { aplicarMascaraTelefone, removerMascara } from "@/lib/mascaras";
import logoMec from "@/assets/logo-mec-novo.png";

export default function CompletarCadastro() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [status, setStatus] = useState<'loading' | 'form' | 'creating' | 'success' | 'error'>('loading');
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [celular, setCelular] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const sessionId = searchParams.get('session_id');
  const plan = searchParams.get('plan');

  // Verificar se já está logado
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // Usuário já logado, redirecionar para obrigado
        navigate(`/obrigado?plan=${plan || ''}`);
        return;
      }

      // Se temos session_id, buscar email do Stripe
      if (sessionId) {
        try {
          const { data, error } = await supabase.functions.invoke('check-checkout-session', {
            body: { sessionId }
          });

          if (error) throw error;

          if (data?.email) {
            setEmail(data.email);
          }
        } catch (err) {
          console.error("Erro ao buscar sessão:", err);
        }
      }

      setStatus('form');
    };

    checkAuth();
  }, [sessionId, plan, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (senha !== confirmarSenha) {
      setErrorMessage("As senhas não coincidem");
      return;
    }

    const celularNumeros = removerMascara(celular);
    if (celularNumeros.length < 10 || celularNumeros.length > 11) {
      setErrorMessage("Informe um celular válido com DDD");
      return;
    }

    if (senha.length < 6) {
      setErrorMessage("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setStatus('creating');

    try {
      // Criar conta
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: senha,
        options: {
          data: { nome, celular: celularNumeros },
          emailRedirectTo: `${window.location.origin}/dashboard`
        }
      });

      if (signUpError) {
        // Mensagem genérica para não revelar se email existe
        console.error("SignUp error:", signUpError.message);
        throw new Error(
          "Não foi possível criar a conta. Se você já possui uma conta, " +
          "tente fazer login. Caso contrário, verifique os dados informados."
        );
      }

      if (signUpData?.user) {
        // Fire-and-forget para não travar o cadastro
        supabase.functions.invoke('webhook-n8n-cadastro', {
          body: { nome, telefone: celularNumeros, user_id: signUpData.user.id },
        }).then(({ error: webhookError }) => {
          if (webhookError) console.error('[n8n webhook] Erro:', webhookError);
          else console.log('[n8n webhook] Dados enviados com sucesso');
        }).catch((webhookErr) => {
          console.error('[n8n webhook] Erro:', webhookErr);
        });
      }

      setStatus('success');

      toast({
        title: "✅ Conta criada!",
        description: "Sua conta foi criada e o plano será ativado automaticamente.",
      });

      setTimeout(() => {
        navigate(`/obrigado?plan=${plan || ''}`);
      }, 2000);

    } catch (err: any) {
      console.error("Erro ao criar conta:", err);
      setErrorMessage(err.message || "Erro ao criar conta. Tente novamente.");
      setStatus('form');
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-[hsl(24_100%_50%)] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <div className="mb-8">
        <img src={logoMec} alt="Méc Logo" className="h-16 w-auto" />
      </div>

      <Card className="w-full max-w-md bg-gray-900 border-gray-800">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            {status === 'success' ? (
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            ) : status === 'creating' ? (
              <Loader2 className="h-16 w-16 text-[hsl(24_100%_50%)] animate-spin" />
            ) : (
              <div className="h-16 w-16 rounded-full bg-[hsl(24_100%_50%_/_0.1)] flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-[hsl(24_100%_50%)]" />
              </div>
            )}
          </div>

          <CardTitle className="text-2xl font-bold text-white">
            {status === 'success' 
              ? "Conta Criada!" 
              : status === 'creating'
                ? "Criando sua conta..."
                : "Complete seu Cadastro"}
          </CardTitle>

          <CardDescription className="text-gray-400">
            {status === 'success' 
              ? "Redirecionando para ativar seu plano..."
              : status === 'creating'
                ? "Aguarde enquanto configuramos tudo..."
                : "Seu pagamento foi confirmado! Crie sua conta para acessar o sistema."}
          </CardDescription>
        </CardHeader>

        {status === 'form' && (
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-400">{errorMessage}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="nome" className="text-white">Nome</Label>
                <Input
                  id="nome"
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome completo"
                  required
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-white">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="bg-gray-800 border-gray-700 text-white"
                />
                <p className="text-xs text-gray-500">
                  Use o mesmo email utilizado no pagamento
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="celular" className="text-white flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  Celular (WhatsApp)
                </Label>
                <Input
                  id="celular"
                  type="tel"
                  value={celular}
                  onChange={(e) => setCelular(aplicarMascaraTelefone(e.target.value))}
                  placeholder="(11) 99999-9999"
                  required
                  maxLength={15}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="senha" className="text-white">Senha</Label>
                <Input
                  id="senha"
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmarSenha" className="text-white">Confirmar Senha</Label>
                <Input
                  id="confirmarSenha"
                  type="password"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  placeholder="Repita sua senha"
                  required
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-[hsl(24_100%_50%)] hover:bg-[hsl(24_100%_45%)] text-white font-semibold h-12"
              >
                Criar Conta e Ativar Plano
              </Button>
            </form>
          </CardContent>
        )}
      </Card>

      <div className="mt-8 text-center text-gray-500 text-sm">
        <p>
          Já tem uma conta?{" "}
          <button 
            onClick={() => navigate('/auth')} 
            className="text-[hsl(24_100%_50%)] hover:underline"
          >
            Fazer login
          </button>
        </p>
      </div>
    </div>
  );
}
