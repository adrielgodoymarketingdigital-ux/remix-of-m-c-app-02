import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PLANOS } from "@/types/plano";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  MessageCircle,
  RefreshCw,
  Shield,
} from "lucide-react";
import logoMec from "@/assets/logo-mec-auth.png";

type ObrigadoStatus = "verificando" | "ativado" | "processando";

interface ObrigadoStatusCardProps {
  status: ObrigadoStatus;
  restaurandoSessao: boolean;
  tentativasDisplay: number;
  plan: string | null;
  planoAtivado: string | null;
  onVerificarAgora: () => void;
  onIrParaDashboard: () => void;
}

const WHATSAPP_SUPORTE_URL = `https://wa.me/5519971454829?text=${encodeURIComponent(
  "Olá! Preciso de ajuda com a ativação do meu plano no Méc."
)}`;

export function ObrigadoStatusCard({
  status,
  restaurandoSessao,
  tentativasDisplay,
  plan,
  planoAtivado,
  onVerificarAgora,
  onIrParaDashboard,
}: ObrigadoStatusCardProps) {
  const planoKey = planoAtivado ?? plan;
  const planoInfo = planoKey ? PLANOS[planoKey as keyof typeof PLANOS] : null;

  const isVerificando = status === "verificando";
  const isAtivado = status === "ativado";
  const isProcessando = status === "processando";

  const icon = restaurandoSessao ? (
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  ) : isAtivado ? (
    <CheckCircle2 className="h-8 w-8 text-success" />
  ) : isProcessando ? (
    <AlertCircle className="h-8 w-8 text-primary" />
  ) : (
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  );

  const title = restaurandoSessao
    ? "Restaurando seu acesso..."
    : isAtivado
      ? "Plano ativado com sucesso!"
      : isProcessando
        ? "Pagamento confirmado!"
        : "Liberando seu acesso...";

  const description = restaurandoSessao
    ? "Confirmando sua sessão para entrar direto no painel."
    : isAtivado
      ? `Seu ${planoInfo?.nome ?? planoAtivado?.replace(/_/g, " ") ?? "plano"} já está liberado.`
      : isProcessando
        ? "Seu pagamento foi recebido. Estamos finalizando a liberação automática do acesso."
        : "Estamos verificando seu pagamento e liberando as funções do seu plano.";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-4">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
      <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />

      <div className="relative w-full max-w-md space-y-6">
        <Card className="relative border-white/10 bg-slate-900/80 p-8 backdrop-blur-xl shadow-[0_0_60px_-15px_rgba(59,130,246,0.3)]">
          <div className="absolute -inset-0.5 -z-10 rounded-lg bg-gradient-to-b from-blue-500/20 via-transparent to-violet-500/10 blur-sm" />

          <div className="mb-8 flex flex-col items-center space-y-3 text-center">
            <img src={logoMec} alt="Méc" className="h-32 w-auto" />

            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/12">
              {icon}
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-white">{title}</h1>
              <p className="text-sm text-slate-400">{description}</p>
              {!restaurandoSessao && isVerificando && (
                <p className="text-xs font-medium text-blue-400">
                  Verificação automática {tentativasDisplay}/15
                </p>
              )}
            </div>
          </div>

          {planoInfo && (
            <div className="mb-6 rounded-xl border border-white/10 bg-slate-800/30 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Plano:</span>
                <span className="font-semibold text-white">{planoInfo.nome}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-sm">
                <span className="text-slate-400">Valor:</span>
                <span className="font-bold text-blue-400">
                  R$ {planoInfo.preco.toFixed(2).replace(".", ",")}
                  {planoInfo.periodo}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm text-slate-400">
                <Check className="h-4 w-4 flex-shrink-0 text-green-400" />
                <span>Seu acesso é liberado automaticamente assim que o pagamento confirma.</span>
              </li>
              <li className="flex items-center gap-2 text-sm text-slate-400">
                <Check className="h-4 w-4 flex-shrink-0 text-green-400" />
                <span>O painel abre sozinho assim que o plano estiver ativo.</span>
              </li>
              <li className="flex items-center gap-2 text-sm text-slate-400">
                <Check className="h-4 w-4 flex-shrink-0 text-green-400" />
                <span>Se precisar, o suporte atende direto no WhatsApp.</span>
              </li>
            </ul>

            {isAtivado ? (
              <Button onClick={onIrParaDashboard} className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white border-0 shadow-[0_0_20px_-5px_rgba(59,130,246,0.5)]" size="lg">
                Ir para o painel
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  onClick={onVerificarAgora}
                  variant="outline"
                  size="lg"
                  disabled={restaurandoSessao || isVerificando}
                  className="w-full border-blue-500/40 text-blue-400 hover:bg-blue-600 hover:text-white hover:border-blue-600"
                >
                  {restaurandoSessao || isVerificando ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-5 w-5" />
                      Verificar agora
                    </>
                  )}
                </Button>

                <Button asChild variant="outline" size="lg" className="w-full">
                  <a href={WHATSAPP_SUPORTE_URL} target="_blank" rel="noreferrer">
                    <MessageCircle className="mr-2 h-5 w-5" />
                    Falar no WhatsApp
                  </a>
                </Button>
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Shield className="h-4 w-4" />
            <span>Liberação segura e automática após a confirmação do pagamento</span>
          </div>
        </Card>
      </div>
    </div>
  );
}