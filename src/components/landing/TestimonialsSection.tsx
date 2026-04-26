import depoimentoWhatsapp1 from "@/assets/depoimento-whatsapp-1.jpg";
import depoimentoWhatsapp2 from "@/assets/depoimento-whatsapp-2.png";
import depoimentoVideo from "@/assets/depoimento-video.mp4";
import { MessageCircle, Quote, Play, Star, Shield, CheckCircle, Users } from "lucide-react";
import { SectionCTA } from "./SectionCTA";
import { useState } from "react";
import { StatCard } from "./StatCard";

// Estatísticas
const stats = [
  { value: 350, suffix: "+", label: "Assistências cadastradas", icon: Users },
  { value: 98, suffix: "%", label: "Taxa de satisfação", icon: Star },
];

export function TestimonialsSection() {
  const [videoPlaying, setVideoPlaying] = useState(false);

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

        {/* Provas visuais */}
        <div className="mb-12">
          <div className="text-center mb-8">
            <h3 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
              Provas reais direto do{" "}
              <span className="text-green-500">WhatsApp</span>
            </h3>
            <p className="text-slate-600">Feedback espontâneo de clientes reais</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Depoimento WhatsApp 1 */}
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500/20 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity blur-sm" />
              <div className="relative bg-white border border-slate-200 rounded-2xl p-3 shadow-sm hover:border-green-300 transition-colors hover:shadow-md">
                <div className="flex items-center gap-2 mb-2 px-2">
                  <MessageCircle className="h-4 w-4 text-green-500" />
                  <span className="text-xs text-green-600 font-medium">WhatsApp Verificado</span>
                </div>
                <img
                  src={depoimentoWhatsapp1}
                  alt="Depoimento de cliente via WhatsApp"
                  className="rounded-xl w-full shadow-sm"
                />
              </div>
            </div>

            {/* Depoimento WhatsApp 2 */}
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500/20 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity blur-sm" />
              <div className="relative bg-white border border-slate-200 rounded-2xl p-3 shadow-sm hover:border-green-300 transition-colors hover:shadow-md">
                <div className="flex items-center gap-2 mb-2 px-2">
                  <MessageCircle className="h-4 w-4 text-green-500" />
                  <span className="text-xs text-green-600 font-medium">WhatsApp Verificado</span>
                </div>
                <img
                  src={depoimentoWhatsapp2}
                  alt="Depoimento de cliente mostrando o sistema"
                  className="rounded-xl w-full shadow-sm object-cover"
                />
              </div>
            </div>

            {/* Depoimento em Vídeo */}
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity blur-sm" />
              <div className="relative bg-white border border-slate-200 rounded-2xl p-3 shadow-sm hover:border-blue-300 transition-colors hover:shadow-md">
                <div className="flex items-center gap-2 mb-2 px-2">
                  <Play className="h-4 w-4 text-blue-500" />
                  <span className="text-xs text-blue-600 font-medium">Vídeo Depoimento</span>
                </div>
                <div className="relative rounded-xl overflow-hidden">
                  <video
                    src={depoimentoVideo}
                    className="w-full h-full object-cover rounded-xl"
                    controls={videoPlaying}
                    playsInline
                    muted
                    loop
                    onClick={() => setVideoPlaying(true)}
                    onPlay={() => setVideoPlaying(true)}
                  />
                  {!videoPlaying && (
                    <button
                      onClick={() => {
                        setVideoPlaying(true);
                        const video = document.querySelector('video');
                        video?.play();
                      }}
                      className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/30 transition-colors"
                    >
                      <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
                        <Play className="w-8 h-8 text-white fill-white ml-1" />
                      </div>
                    </button>
                  )}
                </div>
              </div>
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
