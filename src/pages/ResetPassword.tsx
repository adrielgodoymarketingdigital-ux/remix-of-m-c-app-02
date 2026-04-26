import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import logoMec from "@/assets/logo-mec-auth.png";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [checking, setChecking] = useState(true);
  const validRef = useRef(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const markValid = () => {
      if (!validRef.current) {
        validRef.current = true;
        setIsValidSession(true);
        setChecking(false);
      }
    };

    // 1. Escuta eventos de autenticação (PASSWORD_RECOVERY ou SIGNED_IN)
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (
          (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") &&
          session
        ) {
          markValid();
        }
      }
    );

    // 2. Verifica se o hash da URL contém tokens de recovery
    const hash = window.location.hash;
    const hasRecoveryToken =
      hash.includes("type=recovery") || hash.includes("type=magiclink");

    if (hasRecoveryToken) {
      // O Supabase client vai processar o hash automaticamente,
      // mas vamos dar um tempo extra para garantir
      const interval = setInterval(async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          markValid();
          clearInterval(interval);
        }
      }, 500);

      // Timeout máximo de 10 segundos
      const timeout = setTimeout(() => {
        clearInterval(interval);
        if (!validRef.current) {
          setChecking(false);
          toast({
            variant: "destructive",
            title: "Sessão inválida",
            description:
              "Link de recuperação expirado ou inválido. Solicite um novo link.",
          });
          navigate("/auth");
        }
      }, 10000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
        authListener.subscription.unsubscribe();
      };
    }

    // 3. Se não tem token no hash, tenta pegar sessão existente
    const timeout = setTimeout(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        markValid();
      } else if (!validRef.current) {
        setChecking(false);
        toast({
          variant: "destructive",
          title: "Sessão inválida",
          description:
            "Link de recuperação expirado ou inválido. Solicite um novo link.",
        });
        navigate("/auth");
      }
    }, 3000);

    return () => {
      clearTimeout(timeout);
      authListener.subscription.unsubscribe();
    };
  }, [navigate, toast]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "As senhas não coincidem",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "A senha deve ter no mínimo 6 caracteres",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      toast({
        title: "Senha atualizada com sucesso",
        description: "Você já pode fazer login com sua nova senha",
      });

      setTimeout(() => {
        navigate("/auth");
      }, 2000);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  if (checking || !isValidSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
        <Card className="relative w-full max-w-md p-8 text-center bg-slate-900/80 border border-white/10 backdrop-blur-xl">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-400" />
          <p className="text-slate-400">Verificando sessão...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />

      <Card className="relative w-full max-w-md p-8 space-y-6 bg-slate-900/80 border border-white/10 backdrop-blur-xl shadow-[0_0_60px_-15px_rgba(59,130,246,0.3)]">
        <div className="absolute -inset-0.5 bg-gradient-to-b from-blue-500/20 via-transparent to-violet-500/10 rounded-lg blur-sm -z-10" />
        <div className="flex flex-col items-center space-y-2">
          <img src={logoMec} alt="Méc" className="h-32" />
          <p className="text-sm text-slate-400">Defina sua nova senha</p>
        </div>

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-300">
              Nova Senha
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Digite sua nova senha"
              className="h-11 bg-slate-800/50 border-white/10 text-white placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-blue-500/20"
              minLength={6}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="text-slate-300">
              Confirmar Nova Senha
            </Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Confirme sua nova senha"
              className="h-11 bg-slate-800/50 border-white/10 text-white placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-blue-500/20"
              minLength={6}
            />
          </div>

          <Button
            type="submit"
            className="w-full h-11 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white border-0 shadow-[0_0_20px_-5px_rgba(59,130,246,0.5)] hover:shadow-[0_0_30px_-5px_rgba(59,130,246,0.7)] transition-all duration-300"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Atualizando...
              </>
            ) : (
              "Atualizar Senha"
            )}
          </Button>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={() => navigate("/auth")}
            className="text-sm text-slate-500 hover:text-blue-400 transition-colors"
          >
            Voltar para o login
          </button>
        </div>
      </Card>
    </div>
  );
};

export default ResetPassword;
