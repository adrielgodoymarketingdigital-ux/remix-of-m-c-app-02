import { FeatureCard } from "@/components/landing/FeatureCard";
import { Smartphone, FileSearch, BookOpen, Package } from "lucide-react";
import { SectionCTA } from "./SectionCTA";
import dispositivosEstoqueImg from "@/assets/screenshots/dispositivos-estoque.png";
import origemDispositivosImg from "@/assets/screenshots/origem-dispositivos.png";
import catalogoDispositivosImg from "@/assets/screenshots/catalogo-dispositivos.png";

const sellFeatures = [
  {
    icon: Smartphone,
    title: "Inventario de Dispositivos",
    description: "Gestiona tu inventario completo con costo, precio de venta y ganancia calculada automáticamente",
    image: dispositivosEstoqueImg,
  },
  {
    icon: FileSearch,
    title: "Origen de Dispositivos",
    description: "Controla la procedencia de cada equipo con datos del vendedor, IMEI y comprobante de compra",
    image: origemDispositivosImg,
  },
  {
    icon: BookOpen,
    title: "Catálogo de Dispositivos",
    description: "Crea catálogos personalizados en PDF u online con diferentes plantillas visuales",
    image: catalogoDispositivosImg,
  },
];

export function SellDevicesSection() {
  return (
    <section className="py-24 md:py-32 bg-white relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-violet-500/8 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-blue-500/8 rounded-full blur-[120px]" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center space-y-4 mb-16 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-50 border border-violet-200 text-violet-600 text-sm font-medium">
            <Package className="h-4 w-4" />
            Para Revendedores
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900">
            ¿Vendes{" "}
            <span className="bg-gradient-to-r from-violet-500 to-purple-500 bg-clip-text text-transparent">
              Equipos?
            </span>
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Tenemos funciones personalizadas para quien vende equipos
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {sellFeatures.map((feature, index) => (
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
