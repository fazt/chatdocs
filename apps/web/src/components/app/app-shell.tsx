"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Activity, CreditCard, FileText, LogOut, Menu, MessagesSquare, Shield, Table2, UserRound, Users, X } from "lucide-react";
import { Logo } from "@/components/landing/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { PLAN_LABEL, ROLE_LABEL } from "@/lib/format";
import { useAuth } from "@/stores/auth-store";

interface NavItem {
  href: string;
  label: string;
  icon: typeof FileText;
  exact?: boolean;
}

export function AppShell({ workspaceId, children }: { workspaceId?: string; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, workspaces, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const current = workspaces.find((w) => w.id === workspaceId);

  useEffect(() => setOpen(false), [pathname]);

  const base = workspaceId ? `/app/${workspaceId}` : null;
  const nav: NavItem[] = base
    ? [
        { href: base, label: "Consultas", icon: MessagesSquare, exact: true },
        { href: `${base}/documentos`, label: "Documentos", icon: FileText },
        { href: `${base}/extracciones`, label: "Extracciones", icon: Table2 },
        { href: `${base}/equipo`, label: "Equipo", icon: Users },
        ...(current && current.role !== "viewer" ? [{ href: `${base}/actividad`, label: "Actividad", icon: Activity }] : []),
        { href: `${base}/plan`, label: "Plan y uso", icon: CreditCard },
      ]
    : [];
  const isActive = (item: NavItem) => (item.exact ? pathname === item.href || pathname.startsWith(`${item.href}/chat`) : pathname.startsWith(item.href));

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center justify-between border-b border-border/70 px-4">
        <Link href="/app" aria-label="Folio">
          <Logo />
        </Link>
        <button className="md:hidden" onClick={() => setOpen(false)} aria-label="Cerrar menú">
          <X className="h-4 w-4" />
        </button>
      </div>

      {workspaces.length > 0 && (
        <div className="border-b border-border/70 p-3">
          <label htmlFor="ws-switch" className="mb-1 block px-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Espacio
          </label>
          <select
            id="ws-switch"
            value={workspaceId ?? ""}
            onChange={(e) => router.push(`/app/${e.target.value}`)}
            className="h-9 w-full truncate rounded-lg border border-border bg-background px-2 text-sm"
          >
            {!workspaceId && <option value="">Elegir espacio…</option>}
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          {current && (
            <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
              Plan {PLAN_LABEL[current.plan]} · {ROLE_LABEL[current.role]}
            </p>
          )}
        </div>
      )}

      <nav aria-label="Secciones" className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item) ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
              isActive(item) ? "bg-secondary font-medium text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" aria-hidden />
            {item.label}
          </Link>
        ))}
        {user?.role === "admin" && (
          <Link
            href="/app/admin"
            className={cn("mt-3 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm", pathname.startsWith("/app/admin") ? "bg-secondary font-medium" : "text-muted-foreground hover:bg-secondary/60")}
          >
            <Shield className="h-4 w-4" aria-hidden />
            Administración
          </Link>
        )}
      </nav>

      <div className="flex items-center gap-2 border-t border-border/70 p-3">
        <Link href="/app/cuenta" className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 hover:bg-secondary/60">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
            <UserRound className="h-4 w-4 text-muted-foreground" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-medium">{user?.name}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{user?.email}</span>
          </span>
        </Link>
        <ThemeToggle className="h-8 w-8" />
        <button
          onClick={async () => {
            await logout();
            window.location.href = "/login";
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-full">
      <aside className="hidden w-64 shrink-0 border-r border-border/70 bg-card md:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-border bg-card shadow-xl">{sidebar}</aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-border/70 px-4 md:hidden">
          <button onClick={() => setOpen(true)} aria-label="Abrir menú" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/70">
            <Menu className="h-4 w-4" />
          </button>
          <span className="truncate text-sm font-medium">{current?.name ?? "Folio"}</span>
        </header>
        <main id="contenido" className="min-h-0 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

/** Encabezado estándar de página del panel. */
export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
