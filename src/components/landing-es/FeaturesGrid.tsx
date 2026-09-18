import { FeatureCard } from "@/components/landing/FeatureCard";
import { Wrench, Smartphone, TrendingUp, Package, ShoppingCart, FileText, Play, Cpu } from "lucide-react";
import { SectionCTA } from "./SectionCTA";
import { useState } from "react";
import checklistImg from "@/assets/screenshots/checklist.png";
import avariasImg from "@/assets/screenshots/avarias.png";
import dispositivosImg from "@/assets/screenshots/dispositivos.png";
import vendasImg from "@/assets/screenshots/vendas.png";
import financeiroImg from "@/assets/screenshots/financeiro.png";
import lucrosImg from "@/assets/screenshots/lucros.png";
import demoVideo from "@/assets/demo-recursos.mov";

const features = [
  {
    icon: Wrench,
    title: "Órdenes de Servicio",
    description: "Sistema completo con checklist detallado de entrada y salida para cada dispositivo",
    image: checklistImg,
  },
  {
    icon: Smartphone,
    title: "Marcación de Daños",
    description: "Marca visualmente defectos en siluetas de dispositivos con interfaz intuitiva",
    image: avariasImg,
  },
  {
    icon: Package,
    title: "Gestión de Dispositivos",
    description: "Control completo de inventario con información detallada y estado de cada equipo",
    image: dispositivosImg,
  },
  {
    icon: ShoppingCart,
    title: "Análisis de Ventas",
    description: "Panel con métricas detalladas de ventas, facturación y desempeño en tiempo real",
    image: vendasImg,
  },
  {
    icon: TrendingUp,
    title: "Financiero Completo",
    description: "Visualiza ingresos, costos operativos, ganancias y margen de ganancia automáticamente",
    image: financeiroImg,
  },
  {
    icon: FileText,
    title: "Reporte de Ganancias",
    description: "Análisis detallado por artículo con margen de ganancia, costos y rentabilidad por producto",
    image: lucrosImg,
  },
];

export function FeaturesGrid() {
  const [videoPlaying, setVideoPlaying] = useState(false);

  return (
    <section id="recursos" className="py-24 md:py-32 bg-slate-50 relative overflow-hidden">
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
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/8 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-cyan-500/8 rounded-full blur-[150px]" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center space-y-4 mb-16 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-200 text-blue-600 text-sm font-medium">
            <Cpu className="h-4 w-4" />
            Funciones
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900">
            Recursos{" "}
            <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
              Completos
            </span>
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Más control. Menos estrés. Tu tienda organizada de verdad
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Video Card */}
          <div className="animate-fade-in">
            <div className="group relative overflow-hidden bg-white border border-slate-200 hover:border-blue-300 transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-lg rounded-lg">
              <div className="absolute -inset-0.5 bg-gradient-to-b from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm rounded-xl" />

              <div className="relative">
                {/* Video Section */}
                <div className="relative h-52 sm:h-64 overflow-hidden border-b border-slate-100 bg-slate-900">
                  <video
                    src={demoVideo}
                    className="w-full h-full object-cover"
                    controls={videoPlaying}
                    playsInline
                    onClick={() => setVideoPlaying(true)}
                    onPlay={() => setVideoPlaying(true)}
                  />
                  {!videoPlaying && (
                    <div
                      className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer"
                      onClick={() => {
                        setVideoPlaying(true);
                        const video = document.querySelector('video');
                        video?.play();
                      }}
                    >
                      <div className="w-14 h-14 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center shadow-xl shadow-blue-500/30 group-hover:scale-110 transition-transform">
                        <Play className="h-6 w-6 text-white fill-white ml-0.5" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Content Section */}
                <div className="p-5 space-y-3 relative">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
                      <Play className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">Mensajes por WhatsApp</h3>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Envía mensajes personalizados al WhatsApp del cliente con un solo clic
                  </p>
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </div>
          </div>

          {/* Other Feature Cards */}
          {features.map((feature, index) => (
            <div
              key={index}
              className="animate-fade-in"
              style={{ animationDelay: `${(index + 1) * 0.1}s` }}
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
