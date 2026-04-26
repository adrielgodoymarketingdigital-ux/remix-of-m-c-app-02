import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Zap } from "lucide-react";
import dashboardImg from "@/assets/screenshots/dashboard-landing.png";
import { VideoWithCover } from "@/components/landing/VideoWithCover";

export function HeroSectionLP2() {
  const handleScrollToPlanos = () => {
    const element = document.getElementById('planos');
    element?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16"
      style={{ background: '#030408' }}>
      {/* Ambient lights */}
      <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full blur-[150px] pointer-events-none" style={{ background: 'rgba(0, 240, 255, 0.1)' }} />

      <div className="container mx-auto px-4 py-20 md:py-32 relative z-10">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          <div className="space-y-6 md:space-y-8 animate-fade-in text-center lg:text-left -mt-8 md:-mt-16">

            {/* Alert Badge */}
            <div className="inline-flex items-center gap-3 px-4 py-1.5"
              style={{ border: '1px solid rgba(255, 46, 84, 0.4)', background: 'rgba(255, 46, 84, 0.05)' }}>
              <span className="size-2 bg-red-500 rounded-full animate-pulse" style={{ boxShadow: '0 0 8px #FF2E54' }} />
              <span className="font-mono text-xs tracking-[0.15em] text-red-400 uppercase">
                🔥 Menos de R$1/dia · Desconto por tempo limitado
              </span>
            </div>

            {/* Headline - Aggressive Style */}
            <h1 className="font-bold leading-[0.9] tracking-tight uppercase" style={{ fontFamily: "'Inter', sans-serif" }}>
              <span className="block text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-white/95">
                Seu concorrente está
              </span>
              <span className="block text-4xl sm:text-5xl md:text-6xl lg:text-7xl mt-2"
                style={{ 
                  background: 'linear-gradient(to right, #00F0FF, #0044FF)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}>
                organizando tudo.
              </span>
              <span className="block text-2xl sm:text-3xl md:text-4xl lg:text-5xl mt-4" style={{ color: '#8A91A6' }}>
                Você ainda usa caderno, memória ou um sistema ruim.
              </span>
            </h1>

            {/* Subheadline */}
            <div className="border-l-2 pl-6 py-1" style={{ borderColor: '#00F0FF' }}>
              <p className="text-sm md:text-base leading-relaxed" style={{ color: '#8A91A6' }}>
                Esse é o segredo das grandes assistências que continuam crescendo — saber onde está o lucro.
              </p>
            </div>

            {/* Video */}
            <VideoWithCover />

            {/* Key Benefits */}
            <ul className="hidden md:block space-y-3">
              {["Economize 10h/semana em papelada e planilhas", "Veja seu lucro real por item vendido e serviço", "Recibos legais gerados em 1 clique", "Dashboard com métricas em tempo real"].map((feature, index) => (
                <li key={index} className="flex items-center gap-3 lg:justify-start" style={{ color: '#8A91A6' }}>
                  <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: '#00F0FF' }} />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {/* Mobile Benefits */}
            <ul className="md:hidden grid grid-cols-2 gap-2 text-left">
              {["Configuração em menos de 5 minutos", "Economize 10h/semana", "Lucro em tempo real", "Recibos legais"].map((feature, index) => (
                <li key={index} className="flex items-center gap-2 text-sm" style={{ color: '#8A91A6' }}>
                  <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: '#00F0FF' }} />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 justify-center lg:justify-start">
              <Button
                onClick={handleScrollToPlanos}
                size="lg"
                className="h-12 md:h-14 px-6 md:px-8 text-base font-bold uppercase tracking-wider text-black border-0"
                style={{ 
                  background: '#00F0FF',
                  boxShadow: '0 0 25px rgba(0, 240, 255, 0.15)'
                }}
              >
                <Zap className="mr-2 h-4 w-4" />
                Começar Grátis
              </Button>
              <Button
                onClick={handleScrollToPlanos}
                size="lg"
                variant="outline"
                className="h-12 md:h-14 px-6 md:px-8 text-base font-semibold text-white hover:bg-white/10"
                style={{ border: '2px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)' }}
              >
                Ver Planos
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-6 pt-4 text-sm" style={{ color: '#8A91A6' }}>
              {["24h de acesso Premium grátis", "Cancele a qualquer momento", "Suporte em português"].map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" style={{ color: '#22c55e' }} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Hero Image */}
          <div className="relative animate-fade-in hidden lg:block" style={{ animationDelay: '0.2s' }}>
            <div className="absolute inset-0 rounded-2xl blur-[60px]" style={{ background: 'linear-gradient(to bottom right, rgba(0,240,255,0.1), rgba(0,68,255,0.1))' }} />
            <div className="relative rounded-2xl overflow-hidden shadow-2xl" style={{ border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)' }}>
              <img src={dashboardImg} alt="Dashboard do Sistema Méc" className="w-full h-auto" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
