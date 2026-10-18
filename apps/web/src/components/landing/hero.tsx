import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProductPreview } from "./product-preview";
import { Reveal } from "./reveal";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-10 bg-grid opacity-60" />
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-[640px] bg-radial-fade" />

      <div className="mx-auto grid max-w-7xl gap-12 px-6 pb-24 pt-20 lg:grid-cols-12 lg:gap-10 lg:pb-32 lg:pt-28">
        <div className="lg:col-span-7">
          <Reveal delay={0}>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/80 bg-secondary/40 px-3 py-1 font-mono text-[11px] text-muted-foreground">
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-mint" />
              v0.2 · now streaming answers
              <span className="text-border">·</span>
              <span className="text-foreground">MIT</span>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="text-balance font-sans text-5xl font-medium leading-[1.02] tracking-[-0.03em] sm:text-6xl lg:text-[88px]">
              Your{" "}
              <span className="font-serif-italic text-cream">markdown</span>,
              <br />
              now <span className="font-serif-italic text-cream">answerable</span>.
            </h1>
          </Reveal>

          <Reveal delay={200}>
            <p className="mt-7 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
              ChatDocs turns your <code className="rounded bg-secondary/60 px-1.5 py-0.5 font-mono text-[0.9em] text-foreground/90">.md</code> files
              into a tiny, citation-backed search engine. Drop a doc, ask a
              question, get an answer that quotes the lines it came from.
            </p>
          </Reveal>

          <Reveal delay={320}>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/auth">
                <Button size="lg" className="group h-11 px-5 text-[15px]">
                  Open the app
                  <span className="ml-1.5 text-cream-soft transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </Button>
              </Link>
              <Link href="#how">
                <Button size="lg" variant="outline" className="h-11 px-5 text-[15px]">
                  See how it works
                </Button>
              </Link>
            </div>
          </Reveal>

          <Reveal delay={440}>
            <div className="mt-10 flex items-center gap-6 font-mono text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-mint" />
                self-hosted
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-mint" />
                local-first SQLite
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-mint" />
                no data leaves your machine
              </span>
            </div>
          </Reveal>
        </div>

        <div className="lg:col-span-5">
          <Reveal delay={300} y={28}>
            <div className="animate-float-slow">
              <ProductPreview />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
