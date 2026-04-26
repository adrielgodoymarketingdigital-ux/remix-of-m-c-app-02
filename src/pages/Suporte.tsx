import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, Mail, HelpCircle, Crown, GraduationCap } from "lucide-react";
import { useAssinatura } from "@/hooks/useAssinatura";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { JanelaChat } from "@/components/chat/JanelaChat";
import { useTutorial } from "@/components/tutorial/TutorialContext";

function SuporteContent() {
  const { assinatura } = useAssinatura();
  const navigate = useNavigate();
  const [chatAberto, setChatAberto] = useState(false);
  const { startTutorial, isActive: tutorialAtivo } = useTutorial();

  const temAcessoWhatsApp = assinatura?.plano_tipo &&
    (assinatura.plano_tipo.includes('intermediario') ||
     assinatura.plano_tipo.includes('profissional') ||
     assinatura.plano_tipo === 'admin');

  const handleWhatsApp = () => {
    const phoneNumber = "5519971454829";
    const message = "Olá! Preciso de suporte com o Méc.";
    window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const handleEmail = () => {
    const email = "suporte@zak360.com";
    const subject = "Solicitação de Suporte - Méc";
    const body = "Olá,\n\nPreciso de ajuda com o seguinte:\n\n";
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <main className="flex-1 p-6 overflow-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Suporte</h1>
          <p className="text-muted-foreground">
            Entre em contato conosco. Estamos aqui para ajudar!
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <MessageCircle className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Chat de Suporte</CardTitle>
                  <CardDescription>Converse com nossa equipe</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Abra o chat e fale diretamente com nosso time de suporte dentro do sistema.
              </p>
              <Button onClick={() => setChatAberto(!chatAberto)} className="w-full">
                <MessageCircle className="mr-2 h-4 w-4" />
                {chatAberto ? "Fechar Chat" : "Abrir Chat"}
              </Button>
            </CardContent>
          </Card>

          <Card className={`hover:shadow-lg transition-shadow ${!temAcessoWhatsApp ? 'opacity-60' : ''}`}>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <MessageCircle className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <CardTitle>WhatsApp</CardTitle>
                  <CardDescription>Atendimento rápido e direto</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!temAcessoWhatsApp && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
                  <div className="flex items-start gap-2">
                    <Crown className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                        Recurso Premium
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                        Suporte pelo WhatsApp disponível apenas nos planos Intermediário e Profissional
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Fale conosco pelo WhatsApp e receba atendimento em tempo real.
              </p>
              {temAcessoWhatsApp ? (
                <Button
                  onClick={handleWhatsApp}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Abrir WhatsApp
                </Button>
              ) : (
                <Button
                  onClick={() => navigate('/plano')}
                  variant="outline"
                  className="w-full"
                >
                  <Crown className="mr-2 h-4 w-4" />
                  Ver Planos
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <Mail className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle>Email</CardTitle>
                  <CardDescription>Envie sua mensagem detalhada</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Prefere enviar um email? Descreva sua dúvida ou problema com detalhes.
              </p>
              <ul className="text-sm space-y-2 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-600" />
                  Resposta em até 24 horas
                </li>
                <li className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-blue-600" />
                  Anexe arquivos e prints
                </li>
              </ul>
              <Button
                onClick={handleEmail}
                variant="outline"
                className="w-full border-blue-600 text-blue-600 hover:bg-blue-50"
              >
                <Mail className="mr-2 h-4 w-4" />
                Enviar Email
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-blue-600/10 rounded-lg">
                  <GraduationCap className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle>Tutorial do Sistema</CardTitle>
                  <CardDescription>Aprenda a usar o MÉC</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Inicie o tour guiado para conhecer todas as funcionalidades do sistema passo a passo.
              </p>
              <Button
                onClick={startTutorial}
                disabled={tutorialAtivo}
                variant="outline"
                className="w-full border-blue-600 text-blue-600 hover:bg-blue-50"
              >
                <GraduationCap className="mr-2 h-4 w-4" />
                {tutorialAtivo ? "Tutorial em andamento..." : "Iniciar Tutorial"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {chatAberto && (
          <Card className="h-[500px] flex flex-col overflow-hidden">
            <JanelaChat onClose={() => setChatAberto(false)} />
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Horário de Atendimento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="font-medium mb-2">WhatsApp</h4>
                <p className="text-sm text-muted-foreground">
                  Segunda a Sexta: 8h às 18h<br />
                  Sábado: 8h às 12h
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Email</h4>
                <p className="text-sm text-muted-foreground">
                  24 horas por dia, 7 dias por semana<br />
                  Resposta em até 24 horas úteis
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function Suporte() {
  return (
    <AppLayout>
      <SuporteContent />
    </AppLayout>
  );
}
