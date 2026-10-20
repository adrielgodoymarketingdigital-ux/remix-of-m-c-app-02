import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ehAppInstalado } from "@/components/landing/appInstalado";
import { LandingNav } from "@/components/landing/LandingNav";
import { HeroSection } from "@/components/landing/HeroSection";
import { MobileDemoSection } from "@/components/landing/MobileDemoSection";
import { FeaturesGrid } from "@/components/landing/FeaturesGrid";
import { SellDevicesSection } from "@/components/landing/SellDevicesSection";
import { NotificationsSection } from "@/components/landing/NotificationsSection";
import { StaffSection } from "@/components/landing/StaffSection";
import { FounderSection } from "@/components/landing/FounderSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { SupportSection } from "@/components/landing/SupportSection";
import { SystemDemoSection } from "@/components/landing/SystemDemoSection";
import { ComparisonSection } from "@/components/landing/ComparisonSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { FAQSection } from "@/components/landing/FAQSection";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { LandingFooter } from "@/components/landing/LandingFooter";

export default function Landing() {
  const navigate = useNavigate();
  // Checagem síncrona (matchMedia): o visitante vê o conteúdo já na primeira
  // renderização; só quem abriu pelo app instalado fica sem nada até o redirecionamento.
  const [appInstalado] = useState(ehAppInstalado);

  useEffect(() => {
    if (appInstalado) navigate("/auth", { replace: true });
  }, [appInstalado, navigate]);

  if (appInstalado) {
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
