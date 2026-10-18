import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Nav } from "@/components/landing/nav";
import { Footer } from "@/components/landing/footer";
import { Faq } from "@/components/landing/faq";
import { PLANS_PREVIEW } from "@/components/landing/pricing-teaser";

export const metadata: Metadata = {
  title: "Precios",
  description: "Planes de Folio: Gratis, Pro (USD 19) y Equipo (USD 59) por 30 días. Paga con tarjeta, PayPal o Mercado Pago.",
};

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Nav />
      <main id="contenido" className="flex-1">
        <section className="relative border-b border-border/60 py-20 lg:py-28">
          <div aria-hidden className="absolute inset-0 -z-10 bg-radial-fade" />
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
            <p className="mb-5 font-mono text-[11px] uppercase tracking-[0.25em] text-cream-soft">↳ precios</p>
            <h1 className="text-balance text-5xl font-medium leading-[1.02] tracking-[-0.03em] sm:text-6xl">
              Simple y <span className="font-serif-italic text-cream">sin permanencia</span>.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-pretty text-lg text-muted-foreground">
              El plan es del espacio de trabajo: todo tu equipo comparte los límites. Cada pago activa 30 días y no se renueva solo.
            </p>
          </div>
        </section>

        <section className="py-16 lg:py-20">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:px-6 md:grid-cols-3">
            {PLANS_PREVIEW.map((plan) => (
              <div key={plan.id} className={`flex flex-col rounded-2xl border p-8 ${plan.highlighted ? "border-cream-soft/50 bg-ink" : "border-border/80 bg-card"}`}>
                <div className="flex items-center justify-between">
                  <h2 className="font-mono text-[11px] uppercase tracking-[0.25em] text-cream-soft">{plan.name}</h2>
                  {plan.highlighted && <span className="rounded-full border border-mint/40 bg-mint/10 px-2 py-0.5 font-mono text-[10px] text-mint">recomendado</span>}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
                <p className="mt-8 flex items-baseline gap-1">
                  <span className="text-5xl font-medium tracking-tight">USD {plan.price}</span>
                  <span className="font-mono text-xs text-muted-foreground">/30 días</span>
                </p>
                <ul className="mt-8 space-y-3 border-t border-border/60 pt-6 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-mint" aria-hidden />
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-8">
                  <Link href={plan.id === "free" ? "/registro" : "/registro?plan=" + plan.id}>
                    <Button className="h-11 w-full" variant={plan.highlighted ? "default" : "outline"}>
                      {plan.id === "free" ? "Empezar gratis" : `Elegir ${plan.name}`}
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-10 max-w-2xl px-4 text-center text-sm text-muted-foreground">
            Métodos de pago: tarjeta (Stripe), PayPal y Mercado Pago (cobra en moneda local). Precios en dólares; puedes mejorar el plan desde
            <em> Espacio → Plan</em> en cualquier momento.
          </p>
        </section>
        <Faq />
      </main>
      <Footer />
    </div>
  );
}
