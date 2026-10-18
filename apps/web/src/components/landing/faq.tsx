import { Reveal } from "./reveal";

const faqs = [
  {
    q: "¿Qué significa que una cita esté «verificada»?",
    a: "Que la frase que el modelo puso entre comillas aparece literalmente (ignorando mayúsculas, tildes y saltos de línea) en la página del documento que cita. Si el modelo parafrasea o se equivoca, la cita aparece como no verificada y lo ves antes de usarla.",
  },
  {
    q: "¿Sirve con PDF escaneados?",
    a: "Folio lee el texto del PDF. Si es una imagen escaneada sin capa de texto, te avisará: pásalo antes por OCR (la mayoría de escáneres y Adobe Acrobat lo hacen).",
  },
  {
    q: "¿Mis documentos son privados?",
    a: "Sí. Los originales se guardan sin acceso público y solo los descarga una persona miembro del espacio con sesión iniciada. Cada descarga y exportación queda en la bitácora.",
  },
  {
    q: "¿Qué modelo de IA usa?",
    a: "Claude (Anthropic) u OpenAI si configuras sus claves, o cualquier modelo compatible con la API de OpenAI (por ejemplo, uno local con Ollama). Sin claves funciona en modo demo con respuestas extractivas.",
  },
  {
    q: "¿Reemplaza la revisión de un abogado?",
    a: "No. Folio acelera la lectura y te lleva a la fuente, pero las respuestas son de apoyo: siempre revisa la cláusula completa antes de decidir.",
  },
  {
    q: "¿Cómo pago?",
    a: "Con tarjeta (Stripe), PayPal o Mercado Pago. Cada pago activa el plan por 30 días, sin renovación automática.",
  },
];

export function Faq() {
  return (
    <section className="border-t border-border/60 py-20 lg:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Reveal>
          <h2 className="mb-10 text-balance text-4xl font-medium tracking-[-0.02em]">Preguntas frecuentes</h2>
        </Reveal>
        <div className="divide-y divide-border/70 rounded-2xl border border-border/80">
          {faqs.map((item) => (
            <details key={item.q} className="group px-6 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                {item.q}
                <span aria-hidden className="font-mono text-muted-foreground transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
