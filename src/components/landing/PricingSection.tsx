import { useState } from "react";
import { PricingCard } from "./PricingCard";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PLANOS } from "@/types/plano";
import { Shield, Headphones, Zap, CreditCard } from "lucide-react";

export function PricingSection() {
  const [isAnual, setIsAnual] = useState(false);

  const limitesPlanos = {
    free: [
      "3 Dispositivos cadastrados",
      "3 Ordens de Serviço cadastradas",
      "3 Produtos/Peças cadastradas",
      "50MB de armazenamento",
    ],
    basico: [
      "50 Dispositivos cadastrados",
      "Até 20 OS abertas por mês",
      "Produtos ilimitados",
      "500MB de armazenamento",
    ],
    intermediario: [
      "500 Dispositivos cadastrados",
      "Até 60 OS abertas por mês",
      "10 Dispositivos no Catálogo",
      "1 Funcionário com Comissão",
      "10 links de acompanhamento de OS/mês",
      "5GB de armazenamento",
    ],
    profissional: [
      "Dispositivos ilimitados",
      "OS ilimitadas por mês",
      "Catálogo ilimitado",
      "Funcionários ilimitados",
      "Notificações Automáticas",
      "50 links de acompanhamento de OS/mês",
      "50GB de armazenamento",
    ],
  };

  const planosExibidos = isAnual 
    ? [
        { ...PLANOS.basico_anual, planoKey: "basico_anual", limites: limitesPlanos.basico },
        { ...PLANOS.intermediario_anual, planoKey: "intermediario_anual", popular: true, limites: limitesPlanos.intermediario },
        { ...PLANOS.profissional_anual, planoKey: "profissional_anual", limites: limitesPlanos.profissional }
      ]
    : [
        { ...PLANOS.basico_mensal, planoKey: "basico_mensal", limites: limitesPlanos.basico },
        { ...PLANOS.intermediario_mensal, planoKey: "intermediario_mensal", popular: true, limites: limitesPlanos.intermediario },
        { ...PLANOS.profissional_mensal, planoKey: "profissional_mensal", limites: limitesPlanos.profissional }
      ];

  return (
    <section id="planos" className="py-24 md:py-32 relative overflow-hidden bg-white">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }}
        />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-500/8 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-violet-500/8 rounded-full blur-[150px]" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <div className="text-center space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-200 text-blue-600 text-sm font-medium">
            <Zap className="h-4 w-4" />
            Planos e Preços
          </div>
          
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900">
            Escolha seu{" "}
            <span className="bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 bg-clip-text text-transparent">
              plano ideal
            </span>
          </h2>
          
          <p className="text-lg text-slate-600 max-w-xl mx-auto">
            Comece grátis e teste <span className="font-semibold text-amber-600">TODAS as funcionalidades Premium por 24 horas</span>
            <span className="block text-base text-blue-600 mt-2 font-bold">Ou assine um plano agora abaixo! 👇</span>
          </p>

          {/* Toggle */}
          <div className="flex items-center justify-center gap-4 pt-8">
            <Label 
              htmlFor="pricing-toggle" 
              className={`text-sm cursor-pointer transition-colors ${!isAnual ? "text-slate-900 font-medium" : "text-slate-500"}`}
            >
              Mensal
            </Label>
            <Switch 
              id="pricing-toggle" 
              checked={isAnual} 
              onCheckedChange={setIsAnual}
              className="data-[state=checked]:bg-blue-500 data-[state=unchecked]:bg-slate-300"
            />
            <Label 
              htmlFor="pricing-toggle" 
              className={`text-sm cursor-pointer transition-colors flex items-center gap-2 ${isAnual ? "text-slate-900 font-medium" : "text-slate-500"}`}
            >
              Anual
              <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-600 text-xs font-medium border border-green-200">
                -20%
              </span>
            </Label>
          </div>
        </div>

        {/* Pricing Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          <PricingCard
            nome="Free"
            preco={0}
            periodo="/mês"
            limites={limitesPlanos.free}
            popular={false}
            planoKey="free"
            isAnual={false}
            isFree={true}
          />
          
          {planosExibidos.map((plano, index) => {
            const precosStripe = [
              { mensal: 19.90, anual: 190.80 },
              { mensal: 39.90, anual: 382.80 },
              { mensal: 79.90, anual: 898.80 },
            ];
            const precosOriginais = [39.90, 69.90, 119.90];
            
            return (
              <PricingCard
                key={plano.planoKey}
                nome={plano.nome}
                preco={precosStripe[index].mensal}
                periodo={plano.periodo}
                limites={plano.limites}
                popular={plano.popular}
                planoKey={plano.planoKey}
                precoAnual={isAnual ? precosStripe[index].anual : undefined}
                isAnual={isAnual}
                precoOriginal={precosOriginais[index]}
              />
            );
          })}
        </div>

        {/* Trust Badges */}
        <div className="mt-16 max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Shield, title: "24h Premium Grátis", desc: "Teste tudo" },
              { icon: CreditCard, title: "Stripe", desc: "Pagamento seguro" },
              { icon: Zap, title: "Ativação", desc: "Imediata" },
              { icon: Headphones, title: "Suporte", desc: "Em português" },
            ].map((item, index) => (
              <div 
                key={index}
                className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200"
              >
                <div className="p-2 rounded-lg bg-blue-50">
                  <item.icon className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
