import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "./reveal";

/** Planes (deben coincidir con apps/api/src/config/plans.ts; /precios los lee del API). */
export const PLANS_PREVIEW = [
  { id: "free", name: "Gratis", price: 0, description: "Para probar con tus documentos.", features: ["1 persona", "25 documentos", "500 páginas al mes", "100 preguntas al mes", "Citas verificadas"] },
  {
    id: "pro",
    name: "Pro",
    price: 19,
    description: "Profesionales independientes e investigadores.",
    features: ["Hasta 3 personas", "500 documentos", "10 000 páginas al mes", "2 000 preguntas al mes", "Extracción y exportación"],
    highlighted: true,
  },
  { id: "team", name: "Equipo", price: 59, description: "Estudios, áreas de cumplimiento y grupos.", features: ["Hasta 15 personas con roles", "5 000 documentos", "60 000 páginas al mes", "15 000 preguntas al mes", "Bitácora de auditoría"] },
];

export function PricingTeaser() {
  return (
    <section className="border-t border-border/60 py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.25em] text-cream-soft">↳ precios</p>
          <h2 className="mb-12 text-balance text-4xl font-medium tracking-[-0.02em] sm:text-5xl">
            Paga por mes, <span className="font-serif-italic text-cream">sin permanencia</span>.
          </h2>
        </Reveal>
        <div className="grid gap-6 md:grid-cols-3">
          {PLANS_PREVIEW.map((plan, i) => (
            <Reveal key={plan.id} delay={i * 80}>
              <div className={`flex h-full flex-col rounded-2xl border p-7 ${plan.highlighted ? "border-cream-soft/50 bg-ink" : "border-border/80 bg-card"}`}>
                <h3 className="font-mono text-[11px] uppercase tracking-[0.25em] text-cream-soft">{plan.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
                <p className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-medium">USD {plan.price}</span>
                  <span className="font-mono text-xs text-muted-foreground">/30 días</span>
                </p>
                <ul className="mt-6 space-y-2 border-t border-border/60 pt-5 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-mint" aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link href="/precios">
            <Button variant="outline">Ver precios y métodos de pago</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
