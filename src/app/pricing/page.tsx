"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { Nav } from "@/components/landing/nav";
import { Footer } from "@/components/landing/footer";
import { Reveal } from "@/components/landing/reveal";

const plans = [
  {
    name: "Free",
    price: 0,
    description: "Perfect for trying out ChatDocs",
    features: ["5 documents", "Basic AI chat", "Community support"],
    priceId: null,
    highlighted: false,
  },
  {
    name: "Pro",
    price: 15,
    description: "Best for professionals and small teams",
    features: [
      "Unlimited documents",
      "Advanced AI chat",
      "Priority support",
      "API access",
    ],
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID,
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: 49,
    description: "For large organizations with custom needs",
    features: [
      "Everything in Pro",
      "Custom AI models",
      "Dedicated support",
      "SLA guarantee",
    ],
    priceId: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID,
    highlighted: false,
  },
];

export default function PricingPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState<string | null>(null);

  const handleCheckout = async (priceId: string | null, planName: string) => {
    if (!user) {
      router.push("/auth");
      return;
    }
    if (!priceId) {
      router.push("/auth");
      return;
    }

    setLoading(planName);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("Checkout failed:", data.error);
      }
    } catch (error) {
      console.error("Checkout error:", error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Nav />

      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-border/60 py-24 lg:py-32">
          <div aria-hidden className="absolute inset-0 -z-10 bg-radial-fade" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-grid opacity-50" />
          <div className="mx-auto max-w-5xl px-6 text-center">
            <Reveal>
              <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.25em] text-cream-soft/80">
                ↳ pricing
              </p>
              <h1 className="text-balance text-5xl font-medium leading-[1.02] tracking-[-0.03em] sm:text-6xl lg:text-7xl">
                Simple, transparent{" "}
                <span className="font-serif-italic text-cream">pricing.</span>
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-pretty text-lg text-muted-foreground">
                Choose the plan that best fits your needs. Upgrade or downgrade
                at any time.
              </p>
            </Reveal>
          </div>
        </section>

        <section className="py-20 lg:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {plans.map((plan, i) => (
                <Reveal key={plan.name} delay={i * 80}>
                  <div
                    className={
                      plan.highlighted
                        ? "flex h-full flex-col rounded-2xl border border-cream-soft/40 bg-ink/60 p-8 shadow-[0_0_0_1px_oklch(0.82_0.05_85_/_0.08)]"
                        : "flex h-full flex-col rounded-2xl border border-border/80 bg-ink/40 p-8"
                    }
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-mono text-[11px] uppercase tracking-[0.25em] text-cream-soft/80">
                        {plan.name}
                      </h3>
                      {plan.highlighted && (
                        <span className="rounded-full border border-mint/40 bg-mint/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-mint">
                          popular
                        </span>
                      )}
                    </div>

                    <p className="mt-2 text-sm text-muted-foreground">
                      {plan.description}
                    </p>

                    <div className="mt-8 flex items-baseline gap-1">
                      <span className="text-5xl font-medium tracking-[-0.03em]">
                        ${plan.price}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        /month
                      </span>
                    </div>

                    <ul className="mt-8 space-y-3 border-t border-border/60 pt-6">
                      {plan.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-start gap-2.5 text-sm text-foreground/90"
                        >
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-mint" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-auto pt-8">
                      {plan.highlighted ? (
                        <Button
                          className="group h-11 w-full text-sm"
                          disabled={loading === plan.name}
                          onClick={() => handleCheckout(plan.priceId, plan.name)}
                        >
                          {loading === plan.name ? "Processing..." : "Subscribe"}
                          <span className="ml-1 text-cream-soft transition-transform group-hover:translate-x-0.5">
                            →
                          </span>
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          className="h-11 w-full text-sm"
                          disabled={loading === plan.name}
                          onClick={() => handleCheckout(plan.priceId, plan.name)}
                        >
                          {loading === plan.name
                            ? "Processing..."
                            : plan.price === 0
                              ? "Get started"
                              : "Subscribe"}
                        </Button>
                      )}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={240}>
              <p className="mt-10 text-center font-mono text-[11px] text-muted-foreground">
                self-host for free forever · cancel anytime
              </p>
            </Reveal>
          </div>
        </section>

        <section className="border-t border-border/60 py-24 lg:py-32">
          <div aria-hidden className="absolute inset-0 -z-10 bg-radial-fade" />
          <div className="mx-auto max-w-5xl px-6 text-center">
            <Reveal>
              <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.25em] text-mint/80">
                ↳ not sure yet?
              </p>
              <h2 className="text-balance text-4xl font-medium leading-[1.05] tracking-[-0.03em] sm:text-5xl">
                Try it free.{" "}
                <span className="font-serif-italic text-cream">No card.</span>
              </h2>
              <p className="mx-auto mt-6 max-w-xl text-pretty text-lg text-muted-foreground">
                Spin it up locally in 30 seconds. Your docs, your keys, your
                machine.
              </p>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                <Link href="/auth">
                  <Button size="lg" className="group h-12 px-6 text-base">
                    Open the app
                    <span className="ml-1.5 text-cream-soft transition-transform group-hover:translate-x-0.5">
                      →
                    </span>
                  </Button>
                </Link>
                <Link href="/">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 px-6 text-base"
                  >
                    Back to home
                  </Button>
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
