import { Reveal } from "./reveal";

const features = [
  {
    id: "01",
    title: "Drop a `.md`",
    body: "Drag-and-drop upload. The file is parsed, split into semantic chunks with overlap, and embedded in the background.",
    accent: "text-cream",
  },
  {
    id: "02",
    title: "Search by meaning",
    body: "Your question is embedded with the same model and matched against document chunks via cosine similarity.",
    accent: "text-mint",
  },
  {
    id: "03",
    title: "Ask in plain English",
    body: "Streamed completions cite the exact file and section they came from. No hallucinated section titles.",
    accent: "text-rose",
  },
  {
    id: "04",
    title: "Stays on your machine",
    body: "Everything lives in a single SQLite file. Bring your own OpenAI-compatible key, or swap the provider later.",
    accent: "text-cream-soft",
  },
];

export function Features() {
  return (
    <section id="features" className="relative border-t border-border/60 py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal>
          <div className="mb-16 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.25em] text-cream-soft/80">
                ↳ features
              </p>
              <h2 className="max-w-2xl text-balance text-4xl font-medium leading-[1.05] tracking-[-0.02em] sm:text-5xl">
                A small, opinionated tool that
                <br className="hidden sm:block" />{" "}
                <span className="font-serif-italic text-cream">does one thing well</span>.
              </h2>
            </div>
            <p className="max-w-sm text-pretty text-muted-foreground">
              No vector DB to spin up, no proxy to configure. <code className="font-mono text-foreground/80">pnpm dev</code> and you&rsquo;re chatting.
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border/80 bg-border/60 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <Reveal key={f.id} delay={i * 80}>
              <div className="group relative h-full bg-background p-7 transition-colors hover:bg-ink/60">
                <div className="mb-8 flex items-center justify-between">
                  <span className={`font-mono text-xs ${f.accent}`}>
                    {f.id} /
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                    feature
                  </span>
                </div>
                <h3 className="mb-3 text-xl font-medium tracking-tight">
                  {f.title}
                </h3>
                <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                  {f.body}
                </p>
                <div
                  aria-hidden
                  className={`absolute bottom-0 left-0 h-px w-12 transition-all duration-500 group-hover:w-full ${f.accent.replace("text-", "bg-")}/60`}
                />
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
