import { useState } from "react";
import { PricingCard } from "./PricingCard";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Shield, Headphones, Zap, CreditCard } from "lucide-react";

// Espelha PricingSection.tsx (BR): mesmos planoKey/preços/período, só nomes
// e limites traduzidos — não importa PLANOS (@/types/plano) pra não herdar
// nome em português, mas os planoKey batem exatamente com os mesmos usados
// no restante do sistema (payment_provider/checkout ficam corretos).
const PLANOS_ES: Record<string, { nome: string; periodo: string }> = {
  basico_mensal: { nome: "Plan Básico", periodo: "/mes" },
  basico_anual: { nome: "Plan Básico", periodo: "/mes" },
  intermediario_mensal: { nome: "Plan Intermedio", periodo: "/mes" },
  intermediario_anual: { nome: "Plan Intermedio", periodo: "/mes" },
  profissional_mensal: { nome: "Plan Profesional", periodo: "/mes" },
  profissional_anual: { nome: "Plan Profesional", periodo: "/mes" },
  profissional_ultra_mensal: { nome: "Plan Profesional Ultra", periodo: "/mes" },
  profissional_ultra_anual: { nome: "Plan Profesional Ultra", periodo: "/mes" },
};

export function PricingSection() {
  const [isAnual, setIsAnual] = useState(false);

  const limitesPlanos = {
    free: [
      "3 Dispositivos registrados",
      "3 Órdenes de Servicio registradas",
      "3 Productos/Repuestos registrados",
      "50MB de almacenamiento",
    ],
    basico: [
      "50 Dispositivos registrados",
      "Hasta 20 OS abiertas por mes",
      "Productos ilimitados",
      "500MB de almacenamiento",
    ],
    intermediario: [
      "500 Dispositivos registrados",
      "Hasta 60 OS abiertas por mes",
      "10 Dispositivos en el Catálogo",
      "1 Empleado con Comisión",
      "10 links de seguimiento de OS/mes",
      "5GB de almacenamiento",
    ],
    profissional: [
      "Dispositivos ilimitados",
      "OS ilimitadas por mes",
      "Catálogo ilimitado",
      "Empleados ilimitados",
      "Notificaciones Automáticas",
      "50 links de seguimiento de OS/mes",
      "50GB de almacenamiento",
    ],
    ultra: [
      "Todo del Plan Profesional",
      "Multi Empresas (hasta 3 sucursales)",
      "Links de seguimiento de OS ilimitados",
      "50GB de almacenamiento",
    ],
  };

  const planosExibidos = isAnual
    ? [
        { ...PLANOS_ES.basico_anual, planoKey: "basico_anual", limites: limitesPlanos.basico },
        { ...PLANOS_ES.intermediario_anual, planoKey: "intermediario_anual", popular: true, limites: limitesPlanos.intermediario },
        { ...PLANOS_ES.profissional_anual, planoKey: "profissional_anual", limites: limitesPlanos.profissional },
        { ...PLANOS_ES.profissional_ultra_anual, planoKey: "profissional_ultra_anual", limites: limitesPlanos.ultra },
      ]
    : [
        { ...PLANOS_ES.basico_mensal, planoKey: "basico_mensal", limites: limitesPlanos.basico },
        { ...PLANOS_ES.intermediario_mensal, planoKey: "intermediario_mensal", popular: true, limites: limitesPlanos.intermediario },
        { ...PLANOS_ES.profissional_mensal, planoKey: "profissional_mensal", limites: limitesPlanos.profissional },
        { ...PLANOS_ES.profissional_ultra_mensal, planoKey: "profissional_ultra_mensal", limites: limitesPlanos.ultra },
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
            Planes y Precios
          </div>

          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900">
            Elige tu{" "}
            <span className="bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 bg-clip-text text-transparent">
              plan ideal
            </span>
          </h2>

          <p className="text-lg text-slate-600 max-w-xl mx-auto">
            Empieza gratis y prueba <span className="font-semibold text-amber-600">TODAS las funciones Premium por 24 horas</span>
            <span className="block text-base text-blue-600 mt-2 font-bold">¡O suscríbete a un plan ahora abajo! 👇</span>
          </p>

          {/* Toggle */}
          <div className="flex items-center justify-center gap-4 pt-8">
            <Label
              htmlFor="pricing-toggle"
              className={`text-sm cursor-pointer transition-colors ${!isAnual ? "text-slate-900 font-medium" : "text-slate-500"}`}
            >
              Mensual
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
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6 max-w-7xl mx-auto">
          <PricingCard
            nome="Free"
            preco={0}
            periodo="/mes"
            limites={limitesPlanos.free}
            popular={false}
            planoKey="free"
            isAnual={false}
            isFree={true}
          />

          {planosExibidos.map((plano, index) => {
            const precos = [
              { mensal: 19.90, anual: 190.80 },
              { mensal: 39.90, anual: 382.80 },
              { mensal: 79.90, anual: 898.80 },
              { mensal: 129.90, anual: 1318.80 },
            ];
            const precosOriginais = [39.90, 69.90, 119.90, 179.90];

            return (
              <PricingCard
                key={plano.planoKey}
                nome={plano.nome}
                preco={precos[index].mensal}
                periodo={plano.periodo}
                limites={plano.limites}
                popular={plano.popular}
                planoKey={plano.planoKey}
                precoAnual={isAnual ? precos[index].anual : undefined}
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
              { icon: Shield, title: "24h Premium Gratis", desc: "Prueba todo" },
              { icon: CreditCard, title: "Checkout", desc: "Pago seguro" },
              { icon: Zap, title: "Activación", desc: "Inmediata" },
              { icon: Headphones, title: "Soporte", desc: "En portugués" },
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
