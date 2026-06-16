"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Reveal } from "./reveal";
import { cn } from "@/lib/utils";

const faqs = [
  {
    q: "What file types are supported?",
    a: "Markdown (.md / .mdx) today. The chunker is heading-aware, so H1–H3 become searchable anchors in citations. PDF and code are on the roadmap.",
  },
  {
    q: "Where is my data stored?",
    a: "A single SQLite file on your machine. Documents, chunks, and embeddings never leave your network unless you explicitly point the model at a remote provider.",
  },
  {
    q: "Can I use a different model provider?",
    a: "Yes. Anything OpenAI-compatible works — OpenAI, Groq, Together, OpenRouter, or a local Ollama endpoint. Configure it via OPENAI_BASE_URL and OPENAI_MODEL.",
  },
  {
    q: "How are answers grounded?",
    a: "We embed your question, take the top-k chunks by cosine similarity, and pass them as context to the model with a strict system prompt. Citations are clickable links back to the source file and section.",
  },
  {
    q: "Is this open source?",
    a: "Yes, MIT licensed. Self-host it on a $5 VPS, a Raspberry Pi, or your laptop. Stripe is only used if you opt into the managed Pro tier.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="border-t border-border/60 py-24 lg:py-32">
      <div className="mx-auto max-w-4xl px-6">
        <Reveal>
          <div className="mb-12 text-center">
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.25em] text-cream-soft/80">
              ↳ questions
            </p>
            <h2 className="text-balance text-4xl font-medium leading-[1.05] tracking-[-0.02em] sm:text-5xl">
              The fine print,{" "}
              <span className="font-serif-italic text-cream">briefly</span>.
            </h2>
          </div>
        </Reveal>

        <Reveal>
          <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/40">
            {faqs.map((item, i) => {
              const isOpen = open === i;
              return (
                <div
                  key={item.q}
                  className={cn(
                    "border-b border-border/80 last:border-b-0",
                    isOpen && "bg-ink/40"
                  )}
                >
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-secondary/30 sm:px-8"
                    aria-expanded={isOpen}
                  >
                    <span className="flex items-center gap-4">
                      <span className="font-mono text-xs text-muted-foreground">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="text-base font-medium text-foreground sm:text-lg">
                        {item.q}
                      </span>
                    </span>
                    <Plus
                      className={cn(
                        "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300",
                        isOpen && "rotate-45 text-cream"
                      )}
                    />
                  </button>
                  <div
                    className={cn(
                      "grid overflow-hidden transition-all duration-300 ease-out",
                      isOpen
                        ? "grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0"
                    )}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <p className="px-6 pb-6 pl-[4.25rem] text-pretty text-sm leading-relaxed text-muted-foreground sm:px-8">
                        {item.a}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
