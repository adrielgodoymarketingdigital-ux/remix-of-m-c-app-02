import { LandingNav } from "@/components/landing/LandingNav";
import { HeroSection } from "@/components/landing/HeroSection";
import { MobileDemoSection } from "@/components/landing/MobileDemoSection";
import { FeaturesGrid } from "@/components/landing/FeaturesGrid";
import { SellDevicesSection } from "@/components/landing/SellDevicesSection";
import { NotificationsSection } from "@/components/landing/NotificationsSection";
import { StaffSection } from "@/components/landing/StaffSection";
import { FounderSection } from "@/components/landing/FounderSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { SystemDemoSection } from "@/components/landing/SystemDemoSection";
import { ComparisonSection } from "@/components/landing/ComparisonSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { FAQSection } from "@/components/landing/FAQSection";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { LandingFooter } from "@/components/landing/LandingFooter";

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-50">
      <LandingNav />
      <HeroSection />
      <SystemDemoSection />
      <TestimonialsSection />
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
