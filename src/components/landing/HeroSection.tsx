import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, Zap, Play } from "lucide-react";
import dashboardImg from "@/assets/screenshots/dashboard-landing.png";
import { VideoWithCover } from "@/components/landing/VideoWithCover";

export function HeroSection() {
  const navigate = useNavigate();

  const handleScrollToPlanos = () => {
    const element = document.getElementById('planos');
    element?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-b from-white to-slate-50 pt-16">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(rgba(0,0,0,0.08) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(0,0,0,0.08) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }} />
        
        <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/3 w-[500px] h-[500px] bg-cyan-500/8 rounded-full blur-[150px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-violet-500/5 rounded-full blur-[200px]" />
      </div>
      
      <div className="container mx-auto px-4 py-20 md:py-32 relative z-10">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          <div className="space-y-6 md:space-y-8 animate-fade-in text-center lg:text-left -mt-8 md:-mt-16">
            {/* Discount Banner */}
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 text-red-600 text-sm font-semibold animate-pulse">
              🔥 Menos de R$1 real por dia · Descontos nos planos por tempo limitado!
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1]">
              <span className="bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 bg-clip-text text-transparent">Quando as vendas caem,</span>{" "}
              <span className="text-slate-900">organização vira lucro.</span>
            </h1>

            {/* Subheadline */}
            <p className="text-base md:text-lg text-slate-600 leading-relaxed max-w-xl mx-auto lg:mx-0 text-center">Esse é o segredo das grandes assistências que continuam crescendo, 

saber onde está o lucro.

            

            </p>




            {/* YouTube Video with Cover */}
            <VideoWithCover />

            {/* Key Benefits */}
            <ul className="hidden md:block space-y-3">
              {["Economize 10h/semana em papelada e planilhas", "Veja seu lucro real por item vendido e serviço", "Recibos legais gerados em 1 clique", "Dashboard com métricas em tempo real"].
              map((feature, index) =>
              <li key={index} className="flex items-center gap-3 text-slate-700 lg:justify-start">
                  <CheckCircle2 className="h-5 w-5 text-cyan-500 shrink-0" />
                  <span>{feature}</span>
                </li>
              )}
            </ul>

            {/* Mobile Benefits */}
            <ul className="md:hidden grid grid-cols-2 gap-2 text-left">
              {[
              "Configuração em menos de 5 minutos",
              "Economize 10h/semana",
              "Lucro em tempo real",
              "Recibos legais"].

              map((feature, index) =>
              <li key={index} className="flex items-center gap-2 text-slate-700 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-cyan-500 shrink-0" />
                  <span>{feature}</span>
                </li>
              )}
            </ul>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 justify-center lg:justify-start">
              <Button
                onClick={handleScrollToPlanos}
                size="lg"
                className="h-12 md:h-14 px-6 md:px-8 text-base font-semibold bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg shadow-green-500/25 transition-all">
                
                <Zap className="mr-2 h-4 w-4" />
                Começar Grátis
              </Button>
              <Button
                onClick={handleScrollToPlanos}
                size="lg"
                variant="outline"
                className="h-12 md:h-14 px-6 md:px-8 text-base font-semibold border-2 border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all">
                
                Ver Planos
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-6 pt-4 text-sm text-slate-500">
              {["24h de acesso Premium grátis", "Cancele a qualquer momento", "Suporte em português"].map((item, index) =>
              <div key={index} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>{item}</span>
                </div>
              )}
            </div>
          </div>

          {/* Hero Image */}
          <div className="relative animate-fade-in hidden lg:block" style={{ animationDelay: '0.2s' }}>
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-2xl blur-[60px]" />
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-2xl shadow-slate-300/50">
              <img src={dashboardImg} alt="Dashboard do Sistema Méc" className="w-full h-auto" />
            </div>
          </div>
        </div>
      </div>
    </section>);

}