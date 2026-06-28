import { Smartphone, CheckCircle2, Zap, Clock, RefreshCw, Wifi } from "lucide-react";
import { SectionCTA } from "./SectionCTA";
import { useRef, useState, useEffect } from "react";

function AppStoreBadge() {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white">
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white shrink-0" xmlns="http://www.w3.org/2000/svg">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
      </svg>
      <div className="text-left">
        <p className="text-[9px] text-slate-400 leading-none">Em breve na</p>
        <p className="text-sm font-semibold leading-tight">App Store</p>
      </div>
    </div>
  );
}

function PlayStoreBadge() {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white">
      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" xmlns="http://www.w3.org/2000/svg">
        <path fill="#4285F4" d="M3.18 23.76c.3.17.64.24.99.2L14.54 12 11 8.46z"/>
        <path fill="#EA4335" d="M20.47 10.29l-2.79-1.6-3.99 3.57 3.99 3.57 2.82-1.62c.8-.46.8-1.45-.03-1.92z"/>
        <path fill="#FBBC05" d="M3.17.24C2.83.68 2.67 1.29 2.67 2.07v19.86c0 .78.17 1.39.51 1.83L14.54 12z"/>
        <path fill="#34A853" d="M14.54 12L3.18.24c.09-.06.19-.1.3-.13l.5.29 11.36 6.53z"/>
        <path fill="#34A853" d="M14.54 12l-3.54 3.54 3.99-2.29L14.54 12z" opacity=".5"/>
      </svg>
      <div className="text-left">
        <p className="text-[9px] text-slate-400 leading-none">Em breve no</p>
        <p className="text-sm font-semibold leading-tight">Google Play</p>
      </div>
    </div>
  );
}

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

          <div className="flex flex-col items-center gap-3 pt-2">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Em breve nas lojas</p>
            <div className="flex gap-3 flex-wrap justify-center">
              <AppStoreBadge />
              <PlayStoreBadge />
            </div>
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

            <div className="space-y-3">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Em breve nas lojas</p>
              <div className="flex gap-3 flex-wrap">
                <AppStoreBadge />
                <PlayStoreBadge />
              </div>
            </div>
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
