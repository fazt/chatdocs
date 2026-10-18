const items = [
  "markdown-native",
  "zero config",
  "sqlite · drizzle",
  "openai-compatible",
  "citation-backed",
  "no telemetry",
  "streaming",
  "source links",
  "drag-and-drop",
  "dark only",
];

export function TrustStrip() {
  const doubled = [...items, ...items];
  return (
    <section className="relative border-y border-border/60 bg-ink/40 py-6">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-background to-transparent" />
      <div className="mx-auto max-w-7xl px-6">
        <p className="mb-3 text-center font-mono text-[10.5px] uppercase tracking-[0.25em] text-muted-foreground/70">
          ↳ what you get out of the box
        </p>
        <div className="overflow-hidden">
          <div className="flex w-max gap-10 animate-marquee">
            {doubled.map((label, i) => (
              <span
                key={`${label}-${i}`}
                className="flex shrink-0 items-center gap-3 font-mono text-[13px] text-muted-foreground"
              >
                <span className="h-1 w-1 rounded-full bg-cream-soft/60" />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
