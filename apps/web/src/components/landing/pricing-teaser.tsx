import Link from "next/link";
import { Reveal } from "./reveal";

export function PricingTeaser() {
  return (
    <section className="border-t border-border/60 py-20">
      <div className="mx-auto max-w-5xl px-6">
        <Reveal>
          <div className="flex flex-col items-start gap-6 rounded-2xl border border-border/80 bg-ink/40 p-8 sm:flex-row sm:items-center sm:justify-between sm:p-10">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-cream-soft/80">
                ↳ pricing
              </p>
              <h3 className="mt-2 text-2xl font-medium tracking-tight sm:text-3xl">
                Free to start.{" "}
                <span className="font-serif-italic text-cream">Pro</span> when
                your docs outgrow the seat.
              </h3>
              <p className="mt-2 max-w-lg text-sm text-muted-foreground">
                Self-host for free forever. Pro unlocks unlimited docs,
                priority routing, and the API.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/pricing"
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-secondary/50 px-4 font-mono text-sm text-foreground transition-colors hover:bg-secondary"
              >
                See plans
                <span className="text-cream-soft">→</span>
              </Link>
              <Link
                href="/auth"
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 font-mono text-sm text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Open the app
                <span className="text-primary-foreground/70">→</span>
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
