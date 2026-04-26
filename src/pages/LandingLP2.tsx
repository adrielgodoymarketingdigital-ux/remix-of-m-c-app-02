import { LandingNav } from "@/components/landing/LandingNav";
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
import { HeroSectionLP2 } from "@/components/landing/HeroSectionLP2";
import "./LandingLP2.css";

export default function LandingLP2() {
  return (
    <div className="lp2-dark min-h-screen">
      <LandingNav />
      <HeroSectionLP2 />
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
