import type { Metadata } from "next";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { BenefitsSection } from "@/components/landing/BenefitsSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { FAQSection } from "@/components/landing/FAQSection";
import { CTASection } from "@/components/landing/CTASection";

export const metadata: Metadata = {
  title: "LeadRabbit AI - Turn Reddit Conversations into High-Quality Leads",
  description: "Monitor specific keywords across millions of Reddit discussions. Get instant alerts when people are looking for your solution. Start your 7-day free trial today.",
};

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <BenefitsSection />
      <PricingSection />
      <FAQSection />
      <CTASection />
    </>
  );
}
