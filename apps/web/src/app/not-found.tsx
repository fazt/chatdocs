import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="contenido" className="flex min-h-full flex-col items-center justify-center px-4 py-24 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-cream-soft">error 404</p>
      <h1 className="mt-3 text-4xl font-medium tracking-tight">
        Esta página <span className="font-serif-italic text-cream">no está en el expediente</span>.
      </h1>
      <p className="mt-4 max-w-md text-muted-foreground">El enlace puede estar mal escrito o el contenido fue borrado.</p>
      <div className="mt-8 flex gap-3">
        <Link href="/">
          <Button variant="outline">Ir al inicio</Button>
        </Link>
        <Link href="/app">
          <Button>Ir a mis espacios</Button>
        </Link>
      </div>
    </main>
  );
}
