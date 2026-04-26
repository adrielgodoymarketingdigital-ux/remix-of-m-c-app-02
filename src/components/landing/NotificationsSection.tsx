import { Bell, Crown } from "lucide-react";
import { SectionCTA } from "./SectionCTA";
import notifVendas from "@/assets/screenshots/notif-vendas.png";

function PhoneMockup({ image, alt }: { image: string; alt: string }) {
  return (
    <div className="relative mx-auto w-[220px] sm:w-[260px]">
      <div className="relative rounded-[2.5rem] border-[6px] border-slate-700 bg-black shadow-2xl shadow-slate-400/20 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-b-2xl z-10" />
        <div className="aspect-[9/19.5] overflow-hidden">
          <img src={image} alt={alt} className="w-full h-full object-cover" loading="lazy" />
        </div>
      </div>
      <div className="absolute top-24 -right-[8px] w-[3px] h-10 bg-slate-700 rounded-r" />
      <div className="absolute top-20 -left-[8px] w-[3px] h-6 bg-slate-700 rounded-l" />
      <div className="absolute top-32 -left-[8px] w-[3px] h-10 bg-slate-700 rounded-l" />
    </div>
  );
}

export function NotificationsSection() {
  return (
    <section className="py-24 md:py-32 bg-slate-50 relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-0 right-1/3 w-[500px] h-[500px] bg-emerald-500/8 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] bg-teal-500/8 rounded-full blur-[120px]" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center space-y-4 mb-16 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm font-medium">
            <Bell className="h-4 w-4" />
            Notificações Inteligentes
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900">
            Nunca perca uma{" "}
            <span className="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
              Atualização
            </span>
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Notificações automáticas no celular para cada venda, OS ou pagamento — totalmente personalizáveis
          </p>
        </div>

        <div className="flex flex-col items-center gap-8 max-w-3xl mx-auto">
          <div className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <PhoneMockup image={notifVendas} alt="Notificações de vendas e ordens de serviço" />
          </div>

          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <Crown className="h-4 w-4" />
            Disponível exclusivamente no Plano Profissional
          </div>

          <SectionCTA />
        </div>
      </div>
    </section>
  );
}
