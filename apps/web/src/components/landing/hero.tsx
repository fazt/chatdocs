import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProductPreview } from "./product-preview";
import { Reveal } from "./reveal";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-10 bg-grid opacity-60" />
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-[640px] bg-radial-fade" />

      <div className="mx-auto grid max-w-7xl gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-12 lg:gap-10 lg:pb-32 lg:pt-28">
        <div className="lg:col-span-7">
          <Reveal>
            <div className="mb-6 inline-flex flex-wrap items-center gap-2 rounded-full border border-border/80 bg-secondary/40 px-3 py-1 font-mono text-[11px] text-muted-foreground">
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-mint" />
              para equipos legales, de cumplimiento e investigación
            </div>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="text-balance text-[2.6rem] font-medium leading-[1.04] tracking-[-0.03em] sm:text-6xl lg:text-[80px]">
              Cada respuesta, con su <span className="font-serif-italic text-cream">cita exacta</span> y su{" "}
              <span className="font-serif-italic text-cream">página</span>.
            </h1>
          </Reveal>

          <Reveal delay={200}>
            <p className="mt-7 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
              Sube contratos, políticas, normas o papers y pregunta en lenguaje natural. Folio responde citando el texto literal, verifica
              que la cita exista en el documento y te lleva a la página para que lo compruebes en un clic.
            </p>
          </Reveal>

          <Reveal delay={320}>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/registro">
                <Button size="lg" className="h-11 px-5 text-[15px]">
                  Probar gratis
                  <span className="ml-1.5 text-cream-soft">→</span>
                </Button>
              </Link>
              <Link href="/#como-funciona">
                <Button size="lg" variant="outline" className="h-11 px-5 text-[15px]">
                  Ver cómo funciona
                </Button>
              </Link>
            </div>
          </Reveal>

          <Reveal delay={440}>
            <ul className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11px] text-muted-foreground">
              {["PDF, Word, Markdown y TXT", "citas verificadas", "compara documentos", "exporta con fuentes"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-mint" />
                  {t}
                </li>
              ))}
            </ul>
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
