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
    question: "¿El plan Free es realmente gratuito?",
    answer: "¡Sí! El plan Free es 100% gratuito y puedes usarlo sin límite de tiempo. Incluye acceso al Dashboard, PDV, Dispositivos, Productos y Repuestos, Orden de Servicio y Servicios, con límites de hasta 3 dispositivos, 3 órdenes de servicio, 3 productos/repuestos registrados y 50MB de almacenamiento. Ideal para probar el sistema y conocer todas las funciones."
  },
  {
    question: "¿Puedo hacer upgrade en cualquier momento?",
    answer: "¡Sí! Puedes cambiar de plan cuando quieras. El upgrade es instantáneo y tendrás acceso inmediato a todos los recursos del nuevo plan. El pago es proporcional al período restante."
  },
  {
    question: "¿Qué pasa si alcanzo el límite del plan Free?",
    answer: "Cuando alcances los límites del plan Free (3 dispositivos, 3 órdenes de servicio o 3 productos/repuestos), recibirás una alerta y no podrás registrar nuevos elementos hasta hacer upgrade a un plan pago. Tus datos existentes siguen seguros y accesibles."
  },
  {
    question: "¿Puedo cancelar mi suscripción en cualquier momento?",
    answer: "¡Sí! Puedes cancelar tu suscripción cuando quieras a través del portal del cliente. No hay multas ni cargos por cancelación, y tendrás acceso a los recursos hasta el final del período pagado."
  },
  {
    question: "¿Cómo funciona el downgrade de plan?",
    answer: "Puedes hacer downgrade de tu plan cuando quieras. Los cambios entran en vigor en el próximo ciclo de cobro, y sigues con acceso total al plan actual hasta entonces."
  },
  {
    question: "¿Mis datos están seguros?",
    answer: "¡Sí! Usamos cifrado de extremo a extremo y almacenamiento en la nube seguro. Todos los datos están aislados por usuario y protegidos con políticas de seguridad robustas. Hacemos copias de seguridad diarias automáticas."
  },
  {
    question: "¿Qué plan debo elegir?",
    answer: "Depende del tamaño de tu negocio. El Free es ideal para probar, el Básico para quien está empezando (hasta 50 dispositivos), el Intermedio para negocios en crecimiento (hasta 500 dispositivos), y el Profesional para operaciones más grandes (dispositivos ilimitados)."
  },
  {
    question: "¿Hay soporte técnico disponible?",
    answer: "¡Sí! El plan Free y Básico tienen soporte por email, el Intermedio vía WhatsApp, y el Profesional tiene soporte prioritario por WhatsApp. Todos los planes tienen acceso a nuestra base de conocimiento."
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
            Dudas
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900">
            Preguntas{" "}
            <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
              Frecuentes
            </span>
          </h2>
          <p className="text-lg text-slate-600">
            Resuelve tus dudas sobre los planes y funciones
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
