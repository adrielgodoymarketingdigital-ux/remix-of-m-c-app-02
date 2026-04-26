import { Smartphone, CheckCircle2, Zap, Clock, RefreshCw, Wifi } from "lucide-react";
import { SectionCTA } from "./SectionCTA";
import { useRef, useState, useEffect } from "react";

function LazyVideo({ className }: { className: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px" }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className={className + " relative bg-slate-200"}>
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {isVisible && (
        <video
          ref={videoRef}
          src="/videos/demo-mobile.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onCanPlay={() => setIsLoaded(true)}
          className={`w-full h-full object-cover transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </div>
  );
}

export function MobileDemoSection() {
  return (
    <section className="py-24 md:py-32 bg-white relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 right-0 w-[400px] h-[400px] bg-cyan-500/8 rounded-full blur-[150px] translate-x-1/2" />
        <div className="absolute top-1/2 left-0 w-[300px] h-[300px] bg-blue-500/8 rounded-full blur-[120px] -translate-x-1/2" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Mobile Layout */}
        <div className="lg:hidden flex flex-col items-center text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-600 text-sm font-medium">
            <Smartphone className="h-4 w-4" />
            100% Responsivo
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 leading-tight px-4">
            Acesse pelo seu{" "}
            <span className="bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">celular</span>
          </h2>

          {/* Phone Mockup */}
          <div className="relative w-[260px] sm:w-[280px]">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/15 to-blue-500/15 rounded-[3rem] blur-[50px] scale-90" />
            <div className="relative bg-gradient-to-b from-slate-700 to-slate-800 rounded-[2.5rem] p-2 shadow-2xl shadow-slate-400/30 border border-slate-300">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-6 bg-slate-900 rounded-b-2xl z-20" />
              <div className="relative bg-slate-900 rounded-[2rem] overflow-hidden aspect-[9/19.5]">
                <LazyVideo className="w-full h-full" />
              </div>
            </div>
          </div>

          {/* Mobile Benefits Grid */}
          <p className="text-sm text-slate-600 px-2">
            Instale como app no celular — com ícone na tela inicial, sem baixar pela loja de apps!
          </p>

          <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
            {[
              { icon: Zap, text: "Acesso rápido" },
              { icon: RefreshCw, text: "Sincronização" },
              { icon: Clock, text: "Tempo real" },
              { icon: Smartphone, text: "Instale como app" },
            ].map((item, index) => (
              <div key={index} className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <item.icon className="h-4 w-4 text-cyan-500" />
                <span className="text-sm text-slate-700">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden lg:grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-600 text-sm font-medium">
              <Wifi className="h-4 w-4" />
              100% Responsivo
            </div>

            <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 leading-tight">
              Acesse pelo seu{" "}
              <span className="bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">celular</span>
            </h2>

            <p className="text-lg text-slate-600 leading-relaxed">
              Com o Méc, você tem controle total da sua assistência técnica diretamente do seu celular. 
              Cadastre dispositivos, gere ordens de serviço e acompanhe seus lucros em tempo real.
              Além disso, você pode instalar o Méc como um aplicativo no seu celular, com ícone na tela inicial e acesso rápido — sem precisar baixar nada pela loja de apps.
            </p>

            <ul className="space-y-3">
              {[
                "Interface otimizada para telas pequenas",
                "Acesso rápido às principais funcionalidades",
                "Sincronização em tempo real",
                "Instale como app direto no celular",
              ].map((benefit, index) => (
                <li key={index} className="flex items-center gap-3 text-slate-700">
                  <CheckCircle2 className="h-5 w-5 text-cyan-500 shrink-0" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Phone Mockup */}
          <div className="relative flex justify-center">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/15 to-blue-500/15 rounded-[3rem] blur-[60px] scale-90" />
            <div className="relative w-[300px]">
              <div className="relative bg-gradient-to-b from-slate-700 to-slate-800 rounded-[2.5rem] p-2 shadow-2xl shadow-slate-400/30 border border-slate-300">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-6 bg-slate-900 rounded-b-2xl z-20" />
                <div className="relative bg-slate-900 rounded-[2rem] overflow-hidden aspect-[9/19.5]">
                  <LazyVideo className="w-full h-full" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <SectionCTA />
      </div>
    </section>
  );
}
