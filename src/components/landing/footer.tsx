import Link from "next/link";
import { Logo } from "./logo";

const cols = [
  {
    label: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "How it works", href: "#how" },
      { label: "Demo", href: "#demo" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    label: "Resources",
    links: [
      { label: "Docs", href: "/dashboard" },
      { label: "API reference", href: "/dashboard" },
      { label: "Changelog", href: "/dashboard" },
    ],
  },
  {
    label: "Company",
    links: [
      { label: "GitHub", href: "/dashboard" },
      { label: "MIT license", href: "/dashboard" },
      { label: "Contact", href: "/dashboard" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-4 lg:grid-cols-5">
          <div className="col-span-2 sm:col-span-1 lg:col-span-2">
            <Logo />
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              A small, local-first RAG for your markdown docs. MIT licensed.
            </p>
          </div>

          {cols.map((c) => (
            <div key={c.label}>
              <h4 className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-cream-soft/80">
                {c.label}
              </h4>
              <ul className="space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-border/60 pt-6 sm:flex-row sm:items-center">
          <p className="font-mono text-[11px] text-muted-foreground">
            © {new Date().getFullYear()} ChatDocs · all rights reserved
          </p>
          <p className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-mint" />
            all systems normal
          </p>
        </div>
      </div>
    </footer>
  );
}
