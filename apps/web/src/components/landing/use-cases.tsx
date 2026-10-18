import { BookOpenText, ClipboardCheck, Scale } from "lucide-react";
import { Reveal } from "./reveal";

const cases = [
  {
    icon: Scale,
    title: "Estudios jurídicos y áreas legales",
    points: ["Revisa plazos, penalidades y causales de resolución de un lote de contratos", "Compara la versión del cliente con la de la contraparte", "Exporta la respuesta con sus citas al informe"],
  },
  {
    icon: ClipboardCheck,
    title: "Cumplimiento normativo",
    points: ["Pregunta a políticas internas, reglamentos y normas", "Ubica obligaciones, plazos y responsables con su artículo", "Bitácora de quién consultó o exportó cada documento"],
  },
  {
    icon: BookOpenText,
    title: "Investigación académica",
    points: ["Fichas de lectura: pregunta, método, muestra, resultados y limitaciones", "Compara hallazgos entre papers con la página citada", "Guarda autores, año y DOI de cada documento"],
  },
];

export function UseCases() {
  return (
    <section id="para-quien" className="scroll-mt-16 border-t border-border/60 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.25em] text-rose">↳ para quién</p>
          <h2 className="mb-12 max-w-2xl text-balance text-4xl font-medium leading-[1.05] tracking-[-0.02em] sm:text-5xl">
            Cuando la fuente <span className="font-serif-italic text-cream">importa tanto</span> como la respuesta.
          </h2>
        </Reveal>
        <div className="grid gap-6 lg:grid-cols-3">
          {cases.map((item, i) => (
            <Reveal key={item.title} delay={i * 90}>
              <article className="h-full rounded-2xl border border-border/80 bg-card p-7">
                <item.icon className="mb-5 h-6 w-6 text-cream-soft" aria-hidden />
                <h3 className="mb-4 text-lg font-medium">{item.title}</h3>
                <ul className="space-y-2.5 text-sm text-muted-foreground">
                  {item.points.map((p) => (
                    <li key={p} className="flex gap-2">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-mint" />
                      {p}
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
