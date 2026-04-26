import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAssinatura } from "@/hooks/useAssinatura";

const NUMERO_SUPORTE = "5519971454829";

export function BotaoWhatsAppSuporte() {
  const { assinatura, trialExpirado } = useAssinatura();

  const handleClick = () => {
    let mensagem: string;

    // Verificar se o plano expirou:
    // 1. Trial/demonstração expirado (data_fim passou)
    // 2. Assinatura com status inativo (cancelado, pagamento atrasado, etc)
    const isTrialOuDemo = assinatura?.plano_tipo === 'trial' || assinatura?.plano_tipo === 'demonstracao';
    const dataFimPassou = assinatura?.data_fim && new Date(assinatura.data_fim) < new Date();
    const trialOuDemoExpirado = isTrialOuDemo && dataFimPassou;
    
    const statusInativos = ['canceled', 'past_due', 'unpaid', 'incomplete_expired'];
    const assinaturaInativa = assinatura && statusInativos.includes(assinatura.status || '');
    
    const planoExpirado = trialExpirado || trialOuDemoExpirado || assinaturaInativa;

    console.log('🔍 WhatsApp Status:', { 
      planoTipo: assinatura?.plano_tipo, 
      status: assinatura?.status,
      dataFim: assinatura?.data_fim,
      trialExpirado,
      planoExpirado 
    });

    if (planoExpirado) {
      mensagem = encodeURIComponent(
        "Olá! Meu plano do sistema Méc expirou e ainda não ativei uma assinatura. Gostaria de saber mais sobre os planos disponíveis e como posso continuar usando o sistema."
      );
    } else {
      mensagem = encodeURIComponent("Olá! Preciso de ajuda com o sistema Méc.");
    }

    window.open(`https://wa.me/${NUMERO_SUPORTE}?text=${mensagem}`, "_blank");
  };

  return (
    <div className="fixed bottom-[144px] right-6 z-50 lg:bottom-[70px]">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handleClick}
            size="lg"
            className="h-14 w-14 rounded-full bg-[#25D366] hover:bg-[#20BD5A] shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            <MessageCircle className="h-6 w-6 text-white" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left" className="bg-background border shadow-md">
          <p>Suporte via WhatsApp</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
