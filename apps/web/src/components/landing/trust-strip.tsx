const items = [
  "citas literales verificadas",
  "número de página exacto",
  "búsqueda híbrida semántica + léxica",
  "comparación de contratos",
  "extracción de cláusulas a CSV",
  "exportación con fuentes",
  "equipos con roles",
  "bitácora de auditoría",
  "originales privados",
  "modo demo sin claves",
];

export function TrustStrip() {
  const doubled = [...items, ...items];
  return (
    <section aria-label="Lo que incluye" className="relative border-y border-border/60 bg-ink/50 py-6">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-background to-transparent sm:w-24" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-background to-transparent sm:w-24" />
      <div className="overflow-hidden">
        <ul className="flex w-max animate-marquee gap-10">
          {doubled.map((label, i) => (
            <li key={`${label}-${i}`} aria-hidden={i >= items.length} className="flex shrink-0 items-center gap-3 font-mono text-[13px] text-muted-foreground">
              <span className="h-1 w-1 rounded-full bg-cream-soft/60" />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
