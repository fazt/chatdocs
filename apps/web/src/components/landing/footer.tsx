import Link from "next/link";
import { Logo } from "./logo";

const cols = [
  {
    label: "Producto",
    links: [
      { label: "Funciones", href: "/#funciones" },
      { label: "Cómo funciona", href: "/#como-funciona" },
      { label: "Para quién", href: "/#para-quien" },
      { label: "Precios", href: "/precios" },
    ],
  },
  {
    label: "Cuenta",
    links: [
      { label: "Iniciar sesión", href: "/login" },
      { label: "Crear cuenta", href: "/registro" },
      { label: "Recuperar contraseña", href: "/recuperar" },
    ],
  },
  {
    label: "Proyecto",
    links: [{ label: "Código en GitHub", href: "https://github.com/fazt/chatdocs" }],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <Logo />
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">Chat con documentos con citas verificables por página.</p>
          </div>
          {cols.map((c) => (
            <div key={c.label}>
              <h4 className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-cream-soft">{c.label}</h4>
              <ul className="space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-12 border-t border-border/60 pt-6 font-mono text-[11px] text-muted-foreground">
          © {new Date().getFullYear()} Folio · Las respuestas son de apoyo y no constituyen asesoría legal.
        </p>
      </div>
    </footer>
  );
}
