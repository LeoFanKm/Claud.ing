/**
 * @file Landing.tsx
 * @description Main landing page combining all landing section components
 *
 * @input None
 * @output React component for the landing page
 * @position pages/Landing
 *
 * @lastModified 2026-01-06
 */

console.log("[Landing.tsx] Module loading...");

import {
  AgentSupportSection,
  FAQSection,
  FeaturesSection,
  FooterSection,
  HeroSection,
  LandingNavbar,
  QuickStartSection,
} from "@/components/landing";

console.log("[Landing.tsx] Imports loaded successfully");

export function Landing() {
  console.log("[Landing] Component rendering...");
  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar />
      <main>
        <HeroSection />
        <QuickStartSection />
        <FeaturesSection />
        <AgentSupportSection />
        <FAQSection />
      </main>
      <FooterSection />
    </div>
  );
}
