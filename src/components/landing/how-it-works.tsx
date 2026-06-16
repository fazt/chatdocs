import { Reveal } from "./reveal";

const steps = [
  {
    n: "01",
    title: "Upload your markdown",
    body: "Drop a single file or a folder of docs. ChatDocs preserves heading hierarchy, so each chunk knows which section it came from.",
    code: [
      "$ drop docs/",
      "  ↳ 12 files parsed",
      "  ↳ 184 chunks created",
      "  ↳ 184 embeddings cached",
    ],
  },
  {
    n: "02",
    title: "Ask anything",
    body: "Your question is embedded with the same model. We pull the top-k chunks by cosine similarity and pass them to the model as context.",
    code: [
      "> how do we rotate api keys?",
      "",
      "searching 184 chunks …",
      "  ↳ docs/ops/key-rotation.md  · 0.84",
      "  ↳ docs/ops/secrets.md       · 0.79",
    ],
  },
  {
    n: "03",
    title: "Get a cited answer",
    body: "The model streams a response grounded only in your documents, with clickable source links back to the exact heading.",
    code: [
      "streamed answer ▎",
      "  ↳ source: key-rotation.md § Cadence",
    ],
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="relative border-t border-border/60 py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal>
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.25em] text-mint/80">
            ↳ how it works
          </p>
          <h2 className="max-w-2xl text-balance text-4xl font-medium leading-[1.05] tracking-[-0.02em] sm:text-5xl">
            Three steps, no ceremony.
          </h2>
          <p className="mt-4 max-w-xl text-pretty text-muted-foreground">
            From a markdown file to a cited answer, end-to-end in under a
            second on a warm cache.
          </p>
        </Reveal>

        <div className="mt-16 space-y-px overflow-hidden rounded-2xl border border-border/80 bg-border/60">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 60}>
              <div className="grid grid-cols-1 gap-8 bg-background p-7 lg:grid-cols-12 lg:gap-10 lg:p-10">
                <div className="lg:col-span-5">
                  <div className="mb-5 flex items-center gap-3">
                    <span className="font-serif-italic text-3xl text-cream-soft/90">
                      {s.n}
                    </span>
                    <span className="h-px flex-1 bg-border" />
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                      step
                    </span>
                  </div>
                  <h3 className="text-2xl font-medium tracking-tight">
                    {s.title}
                  </h3>
                  <p className="mt-3 text-pretty text-muted-foreground">
                    {s.body}
                  </p>
                </div>

                <div className="lg:col-span-7">
                  <div className="overflow-hidden rounded-lg border border-border/80 bg-ink/80 shadow-inner">
                    <div className="flex items-center justify-between border-b border-border/80 px-4 py-2 font-mono text-[10.5px] text-muted-foreground">
                      <span>chatdocs · terminal</span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-mint" />
                        live
                      </span>
                    </div>
                    <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-relaxed text-foreground/90">
                      {s.code.map((line, idx) => (
                        <div key={idx} className="flex">
                          <span className="select-none pr-4 text-muted-foreground/40">
                            {idx + 1}
                          </span>
                          <span
                            className={
                              line.startsWith(">")
                                ? "text-cream-soft"
                                : line.startsWith("  ↳")
                                ? "text-mint"
                                : "text-foreground/90"
                            }
                          >
                            {line || "\u00A0"}
                          </span>
                        </div>
                      ))}
                    </pre>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
