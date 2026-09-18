import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LandingNav } from "@/components/landing-es/LandingNav";
import { HeroSection } from "@/components/landing-es/HeroSection";
import { MobileDemoSection } from "@/components/landing-es/MobileDemoSection";
import { FeaturesGrid } from "@/components/landing-es/FeaturesGrid";
import { SellDevicesSection } from "@/components/landing-es/SellDevicesSection";
import { NotificationsSection } from "@/components/landing-es/NotificationsSection";
import { StaffSection } from "@/components/landing-es/StaffSection";
import { FounderSection } from "@/components/landing-es/FounderSection";
import { TestimonialsSection } from "@/components/landing-es/TestimonialsSection";
import { SupportSection } from "@/components/landing-es/SupportSection";
import { SystemDemoSection } from "@/components/landing-es/SystemDemoSection";
import { ComparisonSection } from "@/components/landing-es/ComparisonSection";
import { PricingSection } from "@/components/landing-es/PricingSection";
import { FAQSection } from "@/components/landing-es/FAQSection";
import { FinalCTA } from "@/components/landing-es/FinalCTA";
import { LandingFooter } from "@/components/landing-es/LandingFooter";

// Landing en español (MVP de validación de demanda internacional) — espejo
// estructural exacto de src/pages/Landing.tsx (misma composición de
// secciones, mismo orden, mismo layout). Cada componente importado de
// components/landing-es/ es un fork con el texto traducido; los pocos
// componentes 100% genéricos (sin texto propio) se reusan directo de
// components/landing/ (FeatureCard, StatCard). Nada de esto toca
// src/pages/Landing.tsx ni components/landing/* originales.
export default function LandingES() {
  const navigate = useNavigate();
  const [checkingStandalone, setCheckingStandalone] = useState(true);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true; // fallback iOS

    if (isStandalone) {
      navigate("/auth?intl=1", { replace: true });
      return;
    }

    setCheckingStandalone(false);
  }, [navigate]);

  if (checkingStandalone) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <LandingNav />
      <HeroSection />
      <SystemDemoSection />
      <TestimonialsSection />
      <SupportSection />
      <MobileDemoSection />
      <FeaturesGrid />
      <SellDevicesSection />
      <NotificationsSection />
      <StaffSection />
      <FounderSection />
      <ComparisonSection />
      <PricingSection />
      <FAQSection />
      <FinalCTA />
      <LandingFooter />
    </div>
  );
}
