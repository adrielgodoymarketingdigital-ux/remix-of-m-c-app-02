import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Zap, Rocket } from "lucide-react";

export function FinalCTA() {
  const handleScrollToPlanos = () => {
    const element = document.getElementById('planos');
    element?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="py-24 md:py-32 bg-white relative overflow-hidden">
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
        <div className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[150px]" />
        <div className="absolute top-1/2 right-1/4 translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/8 rounded-full blur-[150px]" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl mx-auto">
          {/* Main CTA Card */}
          <div className="relative p-8 md:p-12 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 shadow-2xl">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-2xl blur-sm" />

            <div className="relative text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-cyan-400 text-sm font-medium backdrop-blur-sm">
                <Rocket className="h-4 w-4" />
                Empieza Ahora
              </div>

              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight">
                ¿Listo para{" "}
                <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">triplicar</span>{" "}
                tus ganancias?
              </h2>

              <p className="text-lg text-slate-400 max-w-xl mx-auto">
                Regístrate y prueba <span className="text-amber-400 font-semibold">todas las funciones Premium por 24 horas</span>.
                Sin tarjeta, sin compromiso.
              </p>

              <div className="flex flex-wrap justify-center gap-6 pt-2">
                {[
                  "24h de acceso Premium gratis",
                  "Configuración en 5 minutos",
                  "Soporte en portugués",
                ].map((benefit, index) => (
                  <div key={index} className="flex items-center gap-2 text-slate-300 text-sm">
                    <Check className="h-4 w-4 text-cyan-400" />
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-4 justify-center pt-4">
                <Button
                  onClick={handleScrollToPlanos}
                  size="lg"
                  className="h-12 md:h-14 px-6 md:px-8 font-semibold bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg shadow-green-500/30 group"
                >
                  <Zap className="mr-2 h-4 w-4" />
                  Empezar Gratis
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button
                  onClick={handleScrollToPlanos}
                  size="lg"
                  variant="outline"
                  className="h-12 md:h-14 px-6 md:px-8 font-semibold border-2 border-white/20 bg-white/5 text-white hover:bg-white/10 backdrop-blur-sm"
                >
                  Ver Planes Pagos
                </Button>
              </div>

              <div className="pt-4 text-xs text-slate-500">
                <p>
                  🔒 Pago 100% seguro •
                  ⚡ Activación inmediata •
                  🚫 Cancela cuando quieras
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
