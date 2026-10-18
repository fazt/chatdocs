import { Cta } from "@/components/landing/cta";
import { Faq } from "@/components/landing/faq";
import { Features } from "@/components/landing/features";
import { Footer } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Nav } from "@/components/landing/nav";
import { PricingTeaser } from "@/components/landing/pricing-teaser";
import { TrustStrip } from "@/components/landing/trust-strip";
import { UseCases } from "@/components/landing/use-cases";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Folio",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: "Chat con documentos con citas literales verificadas por página para equipos legales, de cumplimiento e investigación.",
  offers: [
    { "@type": "Offer", price: "0", priceCurrency: "USD", name: "Gratis" },
    { "@type": "Offer", price: "19", priceCurrency: "USD", name: "Pro" },
    { "@type": "Offer", price: "59", priceCurrency: "USD", name: "Equipo" },
  ],
};

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Nav />
      <main id="contenido" className="flex-1">
        <Hero />
        <TrustStrip />
        <Features />
        <HowItWorks />
        <UseCases />
        <PricingTeaser />
        <Faq />
        <Cta />
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
