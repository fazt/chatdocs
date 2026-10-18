import { Cta } from "@/components/landing/cta";
import { Demo } from "@/components/landing/demo";
import { Faq } from "@/components/landing/faq";
import { Features } from "@/components/landing/features";
import { Footer } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Nav } from "@/components/landing/nav";
import { PricingTeaser } from "@/components/landing/pricing-teaser";
import { TrustStrip } from "@/components/landing/trust-strip";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Nav />
      <main className="flex-1">
        <Hero />
        <TrustStrip />
        <Features />
        <HowItWorks />
        <Demo />
        <PricingTeaser />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </div>
  );
}
