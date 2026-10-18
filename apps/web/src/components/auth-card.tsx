import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/landing/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="relative flex min-h-full flex-col">
      <div aria-hidden className="absolute inset-0 -z-10 bg-grid opacity-50" />
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" aria-label="Folio, inicio">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>
      <main id="contenido" className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm sm:p-8">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </div>
          {footer && <div className="mt-5 text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
