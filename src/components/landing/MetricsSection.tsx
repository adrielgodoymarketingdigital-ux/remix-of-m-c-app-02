import { TrendingUp, Users, Zap, Clock } from "lucide-react";

const metrics = [
  {
    icon: TrendingUp,
    value: "R$ 2M+",
    label: "Faturamento Gerenciado",
    color: "from-[hsl(24_100%_50%)] to-[hsl(24_100%_45%)]"
  },
  {
    icon: Users,
    value: "50k+",
    label: "Ordens Concluídas",
    color: "from-[hsl(24_100%_50%)] to-[hsl(24_100%_40%)]"
  },
  {
    icon: Zap,
    value: "99.9%",
    label: "Uptime Garantido",
    color: "from-[hsl(24_100%_50%)] to-[hsl(24_100%_35%)]"
  },
  {
    icon: Clock,
    value: "24/7",
    label: "Suporte Disponível",
    color: "from-[hsl(24_100%_50%)] to-[hsl(24_100%_30%)]"
  }
];

export function MetricsSection() {
  return (
    <section className="py-24 bg-gradient-to-b from-black to-[hsl(0_0%_6%)] relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(24_100%_50%_/_0.03)_1px,transparent_1px),linear-gradient(to_bottom,hsl(24_100%_50%_/_0.03)_1px,transparent_1px)] bg-[size:6rem_6rem]" />
      
      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-white">
            Números que{" "}
            <span className="bg-gradient-to-r from-[hsl(24_100%_50%)] to-[hsl(24_100%_45%)] bg-clip-text text-transparent">
              Impressionam
            </span>
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Milhares de assistências técnicas confiam no Méc para gerenciar seu negócio
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {metrics.map((metric, index) => (
            <div 
              key={index}
              className="group relative p-8 rounded-2xl bg-black border-2 border-gray-800 hover:border-[hsl(24_100%_50%)] transition-all duration-500 hover:-translate-y-2 animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Glow Effect */}
              <div className="absolute inset-0 bg-[hsl(24_100%_50%_/_0)] group-hover:bg-[hsl(24_100%_50%_/_0.05)] rounded-2xl transition-colors duration-500" />
              
              {/* Icon */}
              <div className="relative mb-6 inline-flex p-3 rounded-xl bg-[hsl(24_100%_50%_/_0.1)] text-[hsl(24_100%_50%)] group-hover:scale-110 transition-transform duration-300">
                <metric.icon className="h-8 w-8" />
              </div>

              {/* Value with Gradient */}
              <div className={`relative text-5xl font-bold mb-2 bg-gradient-to-r ${metric.color} bg-clip-text text-transparent`}>
                {metric.value}
              </div>

              {/* Label */}
              <div className="relative text-gray-400 text-lg">
                {metric.label}
              </div>

              {/* Bottom Orange Line */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[hsl(24_100%_50%)] to-[hsl(24_100%_45%)] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left rounded-b-2xl" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
