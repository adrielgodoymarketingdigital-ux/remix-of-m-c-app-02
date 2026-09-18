import { X, Check, ArrowRight, Sparkles } from "lucide-react";

const comparisons = [
  {
    before: "Anotaciones en papel y hojas de cálculo confusas",
    after: "Panel organizado con toda la información",
  },
  {
    before: "Horas calculando ganancias manualmente",
    after: "Ganancia calculada automáticamente por artículo",
  },
  {
    before: "Recibos escritos a mano sin valor legal",
    after: "Recibos legales generados en segundos",
  },
  {
    before: "Sin control de a quién le compras dispositivos",
    after: "Trazabilidad completa del origen",
  },
  {
    before: "Olvidando cobrar servicios ya terminados",
    after: "Alertas y control de órdenes de servicio",
  },
  {
    before: "Cuentas por pagar mezcladas en la cabeza",
    after: "Finanzas organizadas: pagar y cobrar",
  },
];

export function ComparisonSection() {
  return (
    <section className="py-24 md:py-32 bg-slate-50 relative overflow-hidden">
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
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/8 rounded-full blur-[150px]" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-200 text-blue-600 text-sm font-medium mb-6">
            <Sparkles className="h-4 w-4" />
            Transformación Real
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 mb-4">
            Antes vs{" "}
            <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">Después</span>{" "}
            de Méc
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Mira cómo Méc transforma el día a día de tu taller de reparación
          </p>
        </div>

        {/* Comparison Table */}
        <div className="max-w-4xl mx-auto">
          {/* Header Row */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="text-center p-4 rounded-xl bg-red-50 border border-red-200">
              <span className="text-red-600 font-semibold">❌ Sin Méc</span>
            </div>
            <div className="text-center p-4 rounded-xl bg-green-50 border border-green-200">
              <span className="text-green-600 font-semibold">✅ Con Méc</span>
            </div>
          </div>

          {/* Comparison Rows */}
          <div className="space-y-3">
            {comparisons.map((item, index) => (
              <div key={index} className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white border border-slate-200 hover:border-red-300 transition-colors shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 p-1 rounded-full bg-red-100">
                      <X className="h-3.5 w-3.5 text-red-500" />
                    </div>
                    <span className="text-sm text-slate-600">{item.before}</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white border border-slate-200 hover:border-green-300 transition-colors shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 p-1 rounded-full bg-green-100">
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    </div>
                    <span className="text-sm text-slate-700">{item.after}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center mt-12">
            <a
              href="#planos"
              className="inline-flex items-center gap-2 text-blue-600 font-medium hover:text-cyan-600 transition-colors group"
            >
              Transforma tu negocio ahora
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
