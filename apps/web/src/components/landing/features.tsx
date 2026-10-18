import { Reveal } from "./reveal";

const features = [
  {
    id: "01",
    title: "Citas que se pueden comprobar",
    body: "El modelo debe citar el texto literal entre comillas. Folio busca esa frase en la página original y la marca como verificada (✔) o no (✘). Nada de citas inventadas.",
    accent: "text-cream",
  },
  {
    id: "02",
    title: "La página exacta, en un clic",
    body: "Los PDF se indexan página por página y ningún fragmento mezcla dos páginas. Cada fuente abre el visor en la página con la cita resaltada.",
    accent: "text-mint",
  },
  {
    id: "03",
    title: "Compara documentos",
    body: "Elige dos a seis documentos y pregunta: Folio busca en cada uno por separado y arma una tabla comparativa con referencias. Ideal para contratos y versiones de una norma.",
    accent: "text-rose",
  },
  {
    id: "04",
    title: "Extrae cláusulas y campos",
    body: "Plantillas para contratos, políticas de cumplimiento y fichas de lectura académica. Un campo por fila, con valor, cita, página y exportación a CSV.",
    accent: "text-cream-soft",
  },
  {
    id: "05",
    title: "Búsqueda híbrida",
    body: "Vectores (pgvector) y texto completo de PostgreSQL fusionados con RRF: encuentra tanto «qué pasa si no pago» como «artículo 1430» o un DOI exacto.",
    accent: "text-mint",
  },
  {
    id: "06",
    title: "Hecho para equipos",
    body: "Espacios con roles (propietario, editor, lector), expedientes por caso o proyecto, invitaciones por email y bitácora de quién subió, consultó o exportó qué.",
    accent: "text-cream",
  },
  {
    id: "07",
    title: "Exporta con fuentes",
    body: "Descarga la conversación en Markdown o como HTML imprimible (PDF) con cada respuesta, sus referencias y el estado de verificación de cada cita.",
    accent: "text-rose",
  },
  {
    id: "08",
    title: "Tus archivos, privados",
    body: "Los originales se guardan sin acceso público y solo se descargan con sesión. Funciona con Claude, OpenAI o un modelo local compatible, y en modo demo sin claves.",
    accent: "text-cream-soft",
  },
];

export function Features() {
  return (
    <section id="funciones" className="relative scroll-mt-16 border-t border-border/60 py-20 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <div className="mb-14 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.25em] text-cream-soft">↳ funciones</p>
              <h2 className="max-w-2xl text-balance text-4xl font-medium leading-[1.05] tracking-[-0.02em] sm:text-5xl">
                Para quien no puede permitirse <span className="font-serif-italic text-cream">una cita equivocada</span>.
              </h2>
            </div>
            <p className="max-w-sm text-pretty text-muted-foreground">
              Un chat genérico resume. Folio te dice <em>dónde</em> lo dice el documento, con las palabras exactas, para que puedas firmarlo.
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border/80 bg-border/60 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <Reveal key={f.id} delay={(i % 4) * 80}>
              <div className="group relative h-full bg-background p-7 transition-colors hover:bg-ink/60">
                <span className={`mb-6 block font-mono text-xs ${f.accent}`}>{f.id} /</span>
                <h3 className="mb-3 text-lg font-medium tracking-tight">{f.title}</h3>
                <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
