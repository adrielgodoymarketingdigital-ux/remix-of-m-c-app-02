import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Gift, CheckCircle2, Lock, Phone } from "lucide-react";
import { aplicarMascaraTelefone, removerMascara } from "@/lib/mascaras";
import { trackCompleteRegistration } from "@/lib/tracking";

export default function CadastroTrial() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planFromUrl = searchParams.get("plan") || "intermediario_mensal";
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    whatsapp: "",
    senha: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name === "whatsapp") {
      setFormData(prev => ({ ...prev, [name]: aplicarMascaraTelefone(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome || !formData.email || !formData.whatsapp || !formData.senha) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos para continuar.",
        variant: "destructive",
      });
      return;
    }

    // Validate WhatsApp (minimum 10 digits)
    const whatsappDigits = removerMascara(formData.whatsapp);
    if (whatsappDigits.length < 10) {
      toast({
        title: "WhatsApp inválido",
        description: "Informe um número de WhatsApp válido com DDD.",
        variant: "destructive",
      });
      return;
    }

    if (formData.senha.length < 6) {
      toast({
        title: "Senha muito curta",
        description: "A senha deve ter pelo menos 6 caracteres.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Create account
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.senha,
        options: {
          data: {
            nome: formData.nome,
            celular: whatsappDigits,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        // Track CompleteRegistration com deduplicação Pixel + CAPI
        setTimeout(() => {
          trackCompleteRegistration(data.user!.id, formData.email);
        }, 1500);

        // Enviar dados para webhook n8n (fire-and-forget para não travar o cadastro)
        supabase.functions.invoke('webhook-n8n-cadastro', {
          body: { nome: formData.nome, telefone: whatsappDigits, user_id: data.user!.id },
        }).then(({ error: webhookError }) => {
          if (webhookError) console.error('[n8n webhook] Erro:', webhookError);
          else console.log('[n8n webhook] Dados enviados com sucesso');
        }).catch((webhookErr) => {
          console.error('[n8n webhook] Erro:', webhookErr);
        });

        toast({
          title: "Conta criada! 🎉",
          description: "Agora cadastre seu cartão para começar o teste gratuito.",
        });

        // Redirecionar para pagamento
        window.location.href = `/ativar-trial?plan=${planFromUrl}`;
      }
    } catch (error: any) {
      console.error("Registration error:", error);
      
      let message = "Não foi possível criar sua conta.";
      if (error.message?.includes("already registered")) {
        message = "Este email já está cadastrado. Faça login.";
      } else if (error.message?.includes("weak_password") || error.code === "weak_password") {
        message = "Senha fraca. Use uma senha mais forte com letras, números e caracteres especiais.";
      } else if (error.message?.includes("pwned") || error.weak_password?.reasons?.includes("pwned")) {
        message = "Esta senha foi exposta em vazamentos de dados. Escolha uma senha diferente.";
      }
      
      toast({
        title: "Erro no cadastro",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
            <Gift className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Crie sua conta
          </h1>
          <p className="text-gray-600 mt-2">
            E comece seu teste grátis de 7 dias
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="nome">Seu nome</Label>
              <Input
                id="nome"
                name="nome"
                type="text"
                placeholder="Como você se chama?"
                value={formData.nome}
                onChange={handleChange}
                disabled={loading}
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="seu@email.com"
                value={formData.email}
                onChange={handleChange}
                disabled={loading}
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp" className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                WhatsApp
              </Label>
              <Input
                id="whatsapp"
                name="whatsapp"
                type="tel"
                placeholder="(00) 00000-0000"
                value={formData.whatsapp}
                onChange={handleChange}
                disabled={loading}
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                name="senha"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={formData.senha}
                onChange={handleChange}
                disabled={loading}
                className="h-12"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando conta...
                </>
              ) : (
                <>
                  Criar Conta e Continuar
                </>
              )}
            </Button>
          </form>

          {/* Benefits */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <div className="space-y-3">
              {[
                "7 dias grátis para testar tudo",
                "Sem cobrança até você decidir",
                "Cancele quando quiser",
              ].map((benefit, index) => (
                <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Security note */}
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400">
            <Lock className="h-3 w-3" />
            <span>Dados protegidos com criptografia</span>
          </div>
        </div>

        {/* Already have account */}
        <p className="text-center text-sm text-gray-600 mt-6">
          Já tem uma conta?{" "}
          <button
            onClick={() => navigate("/auth")}
            className="text-blue-600 font-medium hover:underline"
          >
            Fazer login
          </button>
        </p>
      </div>
    </div>
  );
}
