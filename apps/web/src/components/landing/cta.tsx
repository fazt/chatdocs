import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Reveal } from "./reveal";

export function Cta() {
  return (
    <section className="relative border-t border-border/60 py-24 lg:py-32">
      <div aria-hidden className="absolute inset-0 -z-10 bg-radial-fade" />
      <div className="mx-auto max-w-5xl px-6 text-center">
        <Reveal>
          <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.25em] text-mint/80">
            ↳ ready when you are
          </p>
          <h2 className="text-balance text-5xl font-medium leading-[1.02] tracking-[-0.03em] sm:text-6xl lg:text-7xl">
            Stop skimming. <br className="hidden sm:block" />
            <span className="font-serif-italic text-cream">Start asking.</span>
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
            <Link href="/pricing">
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-6 text-base"
              >
                View pricing
              </Button>
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
