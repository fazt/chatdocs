import { Reveal } from "./reveal";

const steps = [
  {
    n: "1",
    title: "Crea un expediente y sube",
    body: "Un expediente por caso, cliente o proyecto de tesis. Arrastra PDF, DOCX, Markdown o TXT: se extrae el texto por página y se indexa en segundo plano.",
  },
  {
    n: "2",
    title: "Pregunta o compara",
    body: "Pregunta sobre todo el expediente o elige documentos concretos. En modo comparación, Folio consulta cada documento por separado y arma una tabla.",
  },
  {
    n: "3",
    title: "Verifica en la página",
    body: "Cada afirmación lleva su referencia [n]. Las citas literales se verifican contra el texto original y abren el visor en la página exacta.",
  },
  {
    n: "4",
    title: "Extrae y exporta",
    body: "Convierte un lote de contratos o papers en una tabla de cláusulas o campos con su cita, y exporta respuestas o tablas para tu informe.",
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="scroll-mt-16 border-t border-border/60 bg-ink/40 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.25em] text-mint">↳ cómo funciona</p>
          <h2 className="mb-12 max-w-2xl text-balance text-4xl font-medium leading-[1.05] tracking-[-0.02em] sm:text-5xl">
            De la carpeta de PDFs a <span className="font-serif-italic text-cream">respuestas con fuente</span>.
          </h2>
        </Reveal>
        <ol className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <Reveal key={step.n} delay={i * 90}>
              <li className="h-full rounded-xl border border-border/80 bg-background p-6">
                <span className="mb-4 inline-flex h-8 w-8 items-center justify-center rounded-full border border-cream-soft/50 font-mono text-sm text-cream">{step.n}</span>
                <h3 className="mb-2 font-medium">{step.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
