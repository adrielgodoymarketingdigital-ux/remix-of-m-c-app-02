import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpCircle } from "lucide-react";
import { SectionCTA } from "./SectionCTA";

const faqs = [
  {
    question: "O plano Free é realmente gratuito?",
    answer: "Sim! O plano Free é 100% gratuito e você pode usar sem limite de tempo. Ele inclui acesso ao Dashboard, PDV, Dispositivos, Produtos e Peças, Ordem de Serviço e Serviços, com limites de até 3 dispositivos, 3 ordens de serviço, 3 produtos/peças cadastrados e 50MB de armazenamento. Ideal para testar o sistema e conhecer todas as funcionalidades."
  },
  {
    question: "Posso fazer upgrade a qualquer momento?",
    answer: "Sim! Você pode mudar de plano a qualquer momento. O upgrade é instantâneo e você terá acesso imediato a todos os recursos do novo plano. O pagamento é proporcional ao período restante."
  },
  {
    question: "O que acontece se eu atingir o limite do plano Free?",
    answer: "Quando você atingir os limites do plano Free (3 dispositivos, 3 ordens de serviço ou 3 produtos/peças), você receberá um alerta e não poderá cadastrar novos itens até fazer upgrade para um plano pago. Seus dados existentes continuam seguros e acessíveis."
  },
  {
    question: "Posso cancelar minha assinatura a qualquer momento?",
    answer: "Sim! Você pode cancelar sua assinatura a qualquer momento através do portal do cliente. Não há multas ou taxas de cancelamento, e você terá acesso aos recursos até o final do período pago."
  },
  {
    question: "Como funciona o downgrade de plano?",
    answer: "Você pode fazer downgrade do seu plano a qualquer momento. As mudanças entram em vigor no próximo ciclo de cobrança, e você continua com acesso total ao plano atual até lá."
  },
  {
    question: "Meus dados ficam seguros?",
    answer: "Sim! Utilizamos criptografia de ponta a ponta e armazenamento em nuvem seguro. Todos os dados são isolados por usuário e protegidos com políticas de segurança robustas. Fazemos backups diários automáticos."
  },
  {
    question: "Qual plano devo escolher?",
    answer: "Depende do tamanho do seu negócio. O Free é ideal para testar, o Básico para quem está começando (até 50 dispositivos), o Intermediário para negócios em crescimento (até 500 dispositivos), e o Profissional para operações maiores (dispositivos ilimitados)."
  },
  {
    question: "Há suporte técnico disponível?",
    answer: "Sim! O plano Free e Básico têm suporte por email, o Intermediário via WhatsApp, e o Profissional tem suporte prioritário por WhatsApp. Todos os planos têm acesso à nossa base de conhecimento."
  }
];

export function FAQSection() {
  return (
    <section id="faq" className="py-24 md:py-32 bg-slate-50 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-blue-500/8 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-1/4 w-[300px] h-[300px] bg-cyan-500/8 rounded-full blur-[120px]" />
      </div>

      <div className="container mx-auto max-w-3xl relative z-10 px-4">
        <div className="text-center space-y-4 mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-200 text-blue-600 text-sm font-medium">
            <HelpCircle className="h-4 w-4" />
            Dúvidas
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900">
            Perguntas{" "}
            <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
              Frequentes
            </span>
          </h2>
          <p className="text-lg text-slate-600">
            Tire suas dúvidas sobre os planos e funcionalidades
          </p>
        </div>

        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map((faq, index) => (
            <AccordionItem 
              key={index} 
              value={`item-${index}`}
              className="bg-white border border-slate-200 rounded-xl px-5 hover:border-blue-300 transition-colors group data-[state=open]:border-blue-400 shadow-sm"
            >
              <AccordionTrigger className="text-left hover:no-underline py-4 [&>svg]:text-blue-500">
                <span className="font-medium text-slate-900 text-sm group-hover:text-blue-600 transition-colors">{faq.question}</span>
              </AccordionTrigger>
              <AccordionContent className="text-slate-600 text-sm pb-4">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <SectionCTA />
      </div>
    </section>
  );
}
