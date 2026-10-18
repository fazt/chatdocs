import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Reveal } from "./reveal";

export function Cta() {
  return (
    <section className="relative border-t border-border/60 py-20 lg:py-28">
      <div aria-hidden className="absolute inset-0 -z-10 bg-radial-fade" />
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
        <Reveal>
          <h2 className="text-balance text-4xl font-medium leading-[1.05] tracking-[-0.03em] sm:text-5xl">
            Sube tu primer contrato. <span className="font-serif-italic text-cream">Pregunta.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-pretty text-lg text-muted-foreground">
            El plan Gratis no pide tarjeta. Si te sirve, invita a tu equipo.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/registro">
              <Button size="lg" className="h-12 px-6 text-base">
                Crear cuenta gratis
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="h-12 px-6 text-base">
                Ya tengo cuenta
              </Button>
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
