export function ProductPreview() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-12 -z-10 bg-radial-fade"
      />

      <div className="overflow-hidden rounded-xl border border-border/80 bg-ink/80 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)] ring-1 ring-white/5">
        <div className="flex items-center justify-between border-b border-border/80 bg-ink/90 px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-cream-soft/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-mint/60" />
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-mint" />
            <span>chatdocs · conversation</span>
          </div>
          <span className="font-mono text-[11px] text-muted-foreground/60">⌘K</span>
        </div>

        <div className="bg-grid">
          <div className="space-y-4 p-5 text-sm">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-secondary/60 font-mono text-[10px] text-muted-foreground">
                you
              </span>
              <div className="rounded-lg rounded-tl-sm bg-secondary/60 px-3.5 py-2.5 text-foreground">
                How do I configure <span className="text-mint">auth</span> in the
                Next.js app router? Token-based, no third-party provider.
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-cream-soft/40 bg-cream-soft/10 font-mono text-[10px] text-cream">
                ◆
              </span>
              <div className="min-w-0 flex-1 space-y-3 rounded-lg rounded-tl-sm border border-border/60 bg-card/50 px-3.5 py-3">
                <p className="text-pretty text-foreground/90">
                  For a self-contained JWT flow, generate the token in a Route
                  Handler and store it in an{" "}
                  <span className="text-mint">httpOnly</span> cookie. Verify it
                  in middleware before reaching your pages.
                </p>

                <pre className="overflow-x-auto rounded-md border border-border/80 bg-background/80 p-3 font-mono text-[11.5px] leading-relaxed text-foreground/90">
                  <code>
                    <span className="text-rose">{"// app/api/auth/login/route.ts"}</span>
                    {"\n"}
                    <span className="text-mint">export async function</span>{" "}
                    <span className="text-cream">POST</span>(req:{" "}
                    <span className="text-cream">Request</span>) {"{"}
                    {"\n"}
                    {"  "}const token = <span className="text-mint">await</span>{" "}
                    <span className="text-cream">sign</span>(payload, secret)
                    {"\n"}
                    {"  "}cookies().set(<span className="text-cream-soft">
                      &quot;session&quot;
                    </span>, token, {"{"}{" "}
                    <span className="text-mint">httpOnly</span>:{" "}
                    <span className="text-rose">true</span> {"}"})
                    {"\n"}
                    {"}"}
                  </code>
                </pre>

                <p className="text-pretty text-foreground/90">
                  Then in{" "}
                  <code className="rounded bg-secondary/70 px-1 py-0.5 font-mono text-[11px]">
                    middleware.ts
                  </code>{" "}
                  verify and redirect. Avoid localStorage for tokens.
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-2.5 py-1 font-mono text-muted-foreground">
                    <span className="h-1 w-1 rounded-full bg-mint" />
                    docs/auth.md · Configuration
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-2.5 py-1 font-mono text-muted-foreground">
                    docs/middleware.md · JWT verify
                  </span>
                </div>

                <p className="flex items-center gap-1 font-mono text-[11px] text-cream-soft">
                  <span className="inline-block h-3 w-1.5 animate-caret bg-cream-soft" />
                  streaming response
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border/80 bg-ink/90 px-4 py-2.5 font-mono text-[11px] text-muted-foreground">
          <span>↳ grounded in 2 documents</span>
          <span>model: gpt-4o-mini · 142ms</span>
        </div>
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-6 -right-6 hidden h-24 w-24 rounded-full border border-cream-soft/15 sm:block"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-3 -top-3 hidden h-3 w-3 rounded-full bg-mint/40 blur-[2px] sm:block"
      />
    </div>
  );
}
