/**
 * @file Landing.tsx
 * @description Main landing page combining all landing section components
 *
 * @input None
 * @output React component for the landing page
 * @position pages/Landing
 *
 * @lastModified 2026-01-08
 */

import {
  AgentSupportSection,
  FAQSection,
  FeaturesSection,
  FooterSection,
  HeroSection,
  LandingNavbar,
  QuickStartSection,
} from "@/components/landing";
import { LandingAuthProvider } from "@/hooks";

export function Landing() {
  return (
    <LandingAuthProvider>
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
    </LandingAuthProvider>
  );
}
