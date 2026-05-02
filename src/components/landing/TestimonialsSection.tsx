import depoimentoWhatsapp1 from "@/assets/depoimento-whatsapp-1.jpg";
import depoimentoWhatsapp2 from "@/assets/depoimento-whatsapp-2.png";
import depoimentoWhatsapp3 from "@/assets/screenshots/depoimento-whatsapp-3.png";
import depoimentoWhatsapp4 from "@/assets/screenshots/depoimento-whatsapp-4.png";
import depoimentoWhatsapp5 from "@/assets/screenshots/depoimento-whatsapp-5.png";
import depoimentoVideo from "@/assets/depoimento-video.mp4";
import { MessageCircle, Quote, Play, Star, Shield, CheckCircle, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { SectionCTA } from "./SectionCTA";
import { useState, useCallback } from "react";
import { StatCard } from "./StatCard";

// Estatísticas
const stats = [
  { value: 350, suffix: "+", label: "Assistências cadastradas", icon: Users },
  { value: 98, suffix: "%", label: "Taxa de satisfação", icon: Star },
];

const slides = [
  { type: "image" as const, src: depoimentoWhatsapp1, alt: "Depoimento de cliente via WhatsApp" },
  { type: "image" as const, src: depoimentoWhatsapp2, alt: "Depoimento de cliente mostrando o sistema" },
  { type: "image" as const, src: depoimentoWhatsapp3, alt: "Cliente recomendando o suporte do Méc" },
  { type: "image" as const, src: depoimentoWhatsapp4, alt: "Cliente elogiando a facilidade do app" },
  { type: "image" as const, src: depoimentoWhatsapp5, alt: "Cliente elogiando o atendimento e o programa" },
  { type: "video" as const, src: depoimentoVideo, alt: "Vídeo depoimento" },
];

export function TestimonialsSection() {
  const [current, setCurrent] = useState(0);
  const [videoPlaying, setVideoPlaying] = useState(false);

  const prev = useCallback(() => {
    setVideoPlaying(false);
    setCurrent((c) => (c - 1 + slides.length) % slides.length);
  }, []);

  const next = useCallback(() => {
    setVideoPlaying(false);
    setCurrent((c) => (c + 1) % slides.length);
  }, []);

  return (
    <section className="py-24 md:py-32 bg-white relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-green-500/8 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-blue-500/8 rounded-full blur-[120px]" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 border border-green-200 text-green-600 text-sm font-medium mb-6">
            <Shield className="h-4 w-4" />
            Depoimentos 100% Reais e Verificados
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 mb-4">
            Quem usa,{" "}
            <span className="bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 bg-clip-text text-transparent">
              recomenda
            </span>
          </h2>
          <p className="text-slate-600 text-lg max-w-2xl mx-auto">
            Veja o que donos de assistências técnicas de todo o Brasil estão falando sobre o Méc.
          </p>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-2 gap-4 md:gap-6 mb-16 max-w-2xl mx-auto">
          {stats.map((stat, index) => (
            <StatCard 
              key={stat.label}
              value={stat.value} 
              suffix={stat.suffix} 
              label={stat.label} 
              icon={stat.icon} 
              index={index} 
            />
          ))}
        </div>

        {/* Carrossel de depoimentos */}
        <div className="mb-12">
          <div className="text-center mb-8">
            <h3 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
              Provas reais direto do{" "}
              <span className="text-green-500">WhatsApp</span>
            </h3>
            <p className="text-slate-600">Feedback espontâneo de clientes reais</p>
          </div>

          <div className="relative max-w-lg mx-auto">
            {/* Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-2 px-2">
                {slides[current].type === "video" ? (
                  <>
                    <Play className="h-4 w-4 text-blue-500" />
                    <span className="text-xs text-blue-600 font-medium">Vídeo Depoimento</span>
                  </>
                ) : (
                  <>
                    <MessageCircle className="h-4 w-4 text-green-500" />
                    <span className="text-xs text-green-600 font-medium">WhatsApp Verificado</span>
                  </>
                )}
                <span className="ml-auto text-xs text-slate-400">{current + 1}/{slides.length}</span>
              </div>

              {slides[current].type === "video" ? (
                <div className="relative rounded-xl overflow-hidden">
                  <video
                    key={current}
                    src={slides[current].src}
                    className="w-full rounded-xl"
                    controls={videoPlaying}
                    playsInline
                    muted
                    loop
                    onClick={() => setVideoPlaying(true)}
                    onPlay={() => setVideoPlaying(true)}
                  />
                  {!videoPlaying && (
                    <button
                      onClick={() => { setVideoPlaying(true); (document.querySelector("video") as HTMLVideoElement)?.play(); }}
                      className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/30 transition-colors"
                    >
                      <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                        <Play className="w-8 h-8 text-white fill-white ml-1" />
                      </div>
                    </button>
                  )}
                </div>
              ) : (
                <img
                  key={current}
                  src={slides[current].src}
                  alt={slides[current].alt}
                  className="rounded-xl w-full shadow-sm"
                />
              )}
            </div>

            {/* Botões de navegação */}
            <button
              onClick={prev}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-5 w-10 h-10 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center hover:border-green-400 hover:text-green-600 transition-colors"
              aria-label="Anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={next}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-5 w-10 h-10 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center hover:border-green-400 hover:text-green-600 transition-colors"
              aria-label="Próximo"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* Dots */}
            <div className="flex justify-center gap-2 mt-4">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setVideoPlaying(false); setCurrent(i); }}
                  className={`w-2 h-2 rounded-full transition-all ${i === current ? "bg-green-500 w-5" : "bg-slate-300 hover:bg-slate-400"}`}
                  aria-label={`Ir para depoimento ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Citação em destaque */}
        <div className="relative max-w-4xl mx-auto">
          <div className="absolute -inset-1 bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-teal-500/10 rounded-3xl blur-lg" />
          <div className="relative bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-3xl p-8 md:p-12 shadow-sm text-center">
            <Quote className="w-16 h-16 text-green-500/20 mx-auto mb-6" />
            <blockquote className="text-2xl md:text-3xl lg:text-4xl font-medium text-slate-900 mb-6 leading-relaxed">
              "Melhor sistema que tem, tô testando hoje e já me{" "}
              <span className="bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">
                surpreendeu bastante
              </span>{" "}
              ✅"
            </blockquote>
            <p className="text-slate-600 text-lg mb-8">
              Feedback espontâneo de um cliente real após experimentar o Méc pela primeira vez.
            </p>

            {/* Trust badges */}
            <div className="flex flex-wrap justify-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-50 border border-slate-200 text-sm text-slate-700">
                <Shield className="h-4 w-4 text-green-500" />
                Verificado
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-50 border border-slate-200 text-sm text-slate-700">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Cliente Real
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-50 border border-slate-200 text-sm text-slate-700">
                <MessageCircle className="h-4 w-4 text-green-500" />
                Via WhatsApp
              </div>
            </div>
          </div>
        </div>

        <SectionCTA />
      </div>
    </section>
  );
}
