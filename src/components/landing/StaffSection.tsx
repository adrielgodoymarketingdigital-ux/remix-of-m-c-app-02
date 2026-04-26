import { FeatureCard } from "./FeatureCard";
import { Users, BadgePercent, Shield } from "lucide-react";
import { SectionCTA } from "./SectionCTA";
import equipeListaImg from "@/assets/screenshots/equipe-lista.png";
import equipeComissaoImg from "@/assets/screenshots/equipe-comissao.png";
import equipePermissoesImg from "@/assets/screenshots/equipe-permissoes.png";

const staffFeatures = [
  {
    icon: Users,
    title: "Cadastro de Funcionários",
    description: "Cadastre vendedores, técnicos e estoquistas com permissões individuais para cada módulo",
    image: equipeListaImg,
  },
  {
    icon: BadgePercent,
    title: "Comissões Automáticas",
    description: "Configure comissões por cargo com porcentagem ou valor fixo sobre vendas e serviços",
    image: equipeComissaoImg,
  },
  {
    icon: Shield,
    title: "Permissões Granulares",
    description: "Controle o acesso a cada módulo: PDV, financeiro, estoque, relatórios e muito mais",
    image: equipePermissoesImg,
  },
];

export function StaffSection() {
  return (
    <section className="py-24 md:py-32 bg-white relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-amber-500/8 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-orange-500/8 rounded-full blur-[120px]" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center space-y-4 mb-16 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200 text-amber-600 text-sm font-medium">
            <Users className="h-4 w-4" />
            Gestão de Equipe
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900">
            Sua equipe com{" "}
            <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
              Comissões
            </span>
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Cadastre funcionários, defina permissões e configure comissões automáticas por cargo
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {staffFeatures.map((feature, index) => (
            <div
              key={index}
              className="animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <FeatureCard {...feature} />
            </div>
          ))}
        </div>

        <SectionCTA />
      </div>
    </section>
  );
}
