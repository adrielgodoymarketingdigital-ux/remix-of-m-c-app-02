import { MessageCircle, Clock, User, Zap, Ban, HeartHandshake, Phone } from "lucide-react";
import { SectionCTA } from "./SectionCTA";

const diferenciais = [
  {
    icon: User,
    title: "Persona real, siempre",
    description: "Ningún bot, ninguna respuesta automática genérica. Cuando escribes, te responde una persona de verdad — alguien que conoce el sistema y entiende tu problema.",
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-100",
  },
  {
    icon: Clock,
    title: "Respuesta rápida de verdad",
    description: "Sin ticket, sin días de espera en cola. La mayoría de las dudas se resuelve el mismo día, muchas veces en minutos.",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-100",
  },
  {
    icon: Zap,
    title: "Problema resuelto, no postergado",
    description: "Aquí no existe el \"te avisamos en los próximos días\". Si tienes un problema, seguimos contigo hasta resolverlo.",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-100",
  },
  {
    icon: HeartHandshake,
    title: "Soporte que conoce tu negocio",
    description: "Méc fue creado por alguien que ya tuvo un taller de reparación. Quien te atiende entiende el día a día de tu tienda — no es un agente genérico de call center.",
    color: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-100",
  },
];

export function SupportSection() {
  return (
    <section className="py-24 lg:py-32 bg-slate-900 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[160px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-cyan-500/8 rounded-full blur-[130px]" />
      </div>

      <div className="container mx-auto px-4 max-w-6xl relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm font-medium mb-6">
            <Phone className="h-4 w-4" />
            Soporte vía WhatsApp
          </div>

          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            Soporte{" "}
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              100% humano
            </span>
            <br />
            que realmente funciona
          </h2>

          <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            Mientras otros sistemas te mandan a un bot o un FAQ, en Méc hablas con una persona de verdad — y sales con el problema resuelto.
          </p>
        </div>

        {/* Comparativo visual */}
        <div className="grid md:grid-cols-2 gap-4 md:gap-6 mb-16 max-w-3xl mx-auto">
          {/* Outros sistemas */}
          <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Ban className="h-5 w-5 text-red-400 flex-shrink-0" />
              <span className="text-red-400 font-semibold text-sm uppercase tracking-wide">Otros sistemas</span>
            </div>
            <ul className="space-y-3 text-slate-400 text-sm">
              {[
                "🤖 Chatbot que no resuelve nada",
                "📋 Abrir ticket y esperar días",
                "📖 \"Consulta nuestra base de conocimiento\"",
                "🔁 Explicar el problema 3 veces a personas diferentes",
                "😤 Caso cerrado sin resolver",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Méc */}
          <div className="rounded-2xl bg-gradient-to-br from-blue-900/50 to-cyan-900/30 border border-blue-500/30 p-6 relative">
            <div className="absolute top-3 right-3 bg-blue-500/20 border border-blue-500/40 rounded-full px-2 py-0.5 text-xs text-blue-300 font-medium">
              Méc
            </div>
            <div className="flex items-center gap-2 mb-4">
              <MessageCircle className="h-5 w-5 text-blue-400 flex-shrink-0" />
              <span className="text-blue-400 font-semibold text-sm uppercase tracking-wide">Soporte Méc</span>
            </div>
            <ul className="space-y-3 text-slate-300 text-sm">
              {[
                "👤 Una persona real te responde",
                "⚡ Respuesta el mismo día, muchas veces en minutos",
                "✅ Seguimos contigo hasta resolver el problema",
                "💬 Directo por WhatsApp, sin burocracia",
                "🛠️ Quien te atiende conoce el sistema por dentro",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Cards de diferenciais */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
          {diferenciais.map(({ icon: Icon, title, description, color, bg, border }) => (
            <div
              key={title}
              className="rounded-2xl bg-slate-800/50 border border-slate-700 p-5 hover:border-slate-500 transition-colors"
            >
              <div className={`inline-flex p-2.5 rounded-xl ${bg} ${border} border mb-4`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <h3 className="text-white font-semibold text-sm mb-2">{title}</h3>
              <p className="text-slate-400 text-xs leading-relaxed">{description}</p>
            </div>
          ))}
        </div>

        {/* Citação destaque */}
        <div className="relative max-w-2xl mx-auto text-center mb-12">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-3xl blur-lg" />
          <div className="relative rounded-3xl bg-slate-800/80 border border-blue-500/20 px-8 py-8">
            <MessageCircle className="h-8 w-8 text-blue-400/40 mx-auto mb-4" />
            <p className="text-white text-xl md:text-2xl font-medium leading-relaxed mb-4">
              "Todo sistema va a tener dudas y errores en el peor momento.{" "}
              <span className="text-blue-400">La diferencia es lo que pasa después de que pides ayuda."</span>
            </p>
            <p className="text-slate-400 text-sm">— Adriel, fundador de Méc</p>
          </div>
        </div>

        <SectionCTA />
      </div>
    </section>
  );
}
