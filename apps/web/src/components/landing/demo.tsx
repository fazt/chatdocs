import { Reveal } from "./reveal";

export function Demo() {
  return (
    <section id="demo" className="relative border-t border-border/60 py-24 lg:py-32">
      <div aria-hidden className="absolute inset-0 -z-10 bg-grain opacity-[0.04]" />
      <div className="mx-auto max-w-7xl px-6">
        <Reveal>
          <div className="mb-12 max-w-2xl">
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.25em] text-rose/80">
              ↳ see it run
            </p>
            <h2 className="text-balance text-4xl font-medium leading-[1.05] tracking-[-0.02em] sm:text-5xl">
              The doc on the left.
              <br />
              <span className="font-serif-italic text-cream">The answer on the right.</span>
            </h2>
          </div>
        </Reveal>

        <Reveal y={24}>
          <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/50 shadow-[0_40px_100px_-40px_rgba(0,0,0,0.7)]">
            <div className="flex items-center justify-between border-b border-border/80 bg-ink/80 px-4 py-2.5">
              <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-mint" />
                live session · docs/auth.md
              </div>
              <div className="flex items-center gap-3 font-mono text-[10.5px] text-muted-foreground">
                <span>3 chunks matched</span>
                <span className="text-border">·</span>
                <span>198ms</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2">
              <div className="border-b border-border/80 bg-background/60 p-7 lg:border-b-0 lg:border-r">
                <div className="mb-4 flex items-center gap-2 font-mono text-[10.5px] text-muted-foreground">
                  <span className="rounded border border-border bg-secondary/60 px-1.5 py-0.5">
                    md
                  </span>
                  docs/auth.md
                </div>

                <article className="prose-chat space-y-3 text-[13.5px] leading-relaxed">
                  <h3 className="font-mono text-base font-medium tracking-tight text-foreground">
                    # Authentication
                  </h3>
                  <p className="text-muted-foreground">
                    We use a token-based flow with <code className="rounded bg-secondary/70 px-1 py-0.5 font-mono text-[12px] text-cream-soft">httpOnly</code> cookies. No third-party identity provider.
                  </p>

                  <h4 className="font-mono text-[13.5px] font-medium tracking-tight text-foreground">
                    ## Configuration
                  </h4>
                  <p className="text-muted-foreground">
                    Set <code className="rounded bg-secondary/70 px-1 py-0.5 font-mono text-[12px] text-cream-soft">JWT_SECRET</code> in your env, then call{" "}
                    <code className="rounded bg-secondary/70 px-1 py-0.5 font-mono text-[12px] text-mint">sign(payload)</code> in your login route.
                  </p>

                  <pre className="overflow-x-auto rounded-md border border-border/80 bg-ink/80 p-3 font-mono text-[12px] leading-relaxed">
                    <code>
                      <span className="text-rose">{"// app/api/auth/login/route.ts"}</span>
                      {"\n"}
                      <span className="text-mint">import</span> {"{ sign }"} <span className="text-mint">from</span>{" "}
                      <span className="text-cream-soft">&quot;@/lib/jwt&quot;</span>
                      {"\n\n"}
                      <span className="text-mint">export async function</span>{" "}
                      <span className="text-cream">POST</span>(req) {"{"}
                      {"\n"}
                      {"  "}const user = <span className="text-mint">await</span>{" "}
                      <span className="text-cream">verify</span>(req)
                      {"\n"}
                      {"  "}const token = <span className="text-mint">await</span>{" "}
                      <span className="text-cream">sign</span>({"{ sub: user.id }"})
                      {"\n"}
                      {"}"}
                    </code>
                  </pre>

                  <h4 className="font-mono text-[13.5px] font-medium tracking-tight text-foreground">
                    ## Verification
                  </h4>
                  <p className="text-muted-foreground">
                    Middleware decodes the token and either lets the request
                    through or redirects to <code className="rounded bg-secondary/70 px-1 py-0.5 font-mono text-[12px] text-cream-soft">/login</code>.
                  </p>
                </article>
              </div>

              <div className="bg-grid p-7">
                <div className="mb-4 flex items-center gap-2 font-mono text-[10.5px] text-muted-foreground">
                  <span className="rounded border border-border bg-secondary/60 px-1.5 py-0.5">
                    chat
                  </span>
                  conversation
                </div>

                <div className="space-y-4 text-[13.5px]">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-secondary/60 font-mono text-[10px] text-muted-foreground">
                      you
                    </span>
                    <div className="rounded-lg rounded-tl-sm bg-secondary/60 px-3.5 py-2.5 text-foreground">
                      How do I set up auth in this repo?
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-cream-soft/40 bg-cream-soft/10 font-mono text-[10px] text-cream">
                      ◆
                    </span>
                    <div className="min-w-0 flex-1 space-y-3 rounded-lg rounded-tl-sm border border-border/60 bg-card/50 px-3.5 py-3">
                      <p className="text-pretty text-foreground/90">
                        Two parts: a login route that signs a JWT into an{" "}
                        <span className="text-mint">httpOnly</span> cookie,
                        and middleware that verifies it on every request.
                      </p>
                      <p className="text-pretty text-foreground/90">
                        The <code className="rounded bg-secondary/70 px-1 py-0.5 font-mono text-[11.5px] text-cream-soft">Configuration</code> section walks through{" "}
                        <code className="rounded bg-secondary/70 px-1 py-0.5 font-mono text-[11.5px] text-mint">sign(payload)</code> in{" "}
                        <code className="rounded bg-secondary/70 px-1 py-0.5 font-mono text-[11.5px]">app/api/auth/login/route.ts</code>.
                      </p>
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-2.5 py-1 font-mono text-muted-foreground">
                          <span className="h-1 w-1 rounded-full bg-mint" />
                          docs/auth.md · Configuration
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-2.5 py-1 font-mono text-muted-foreground">
                          docs/auth.md · Verification
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
