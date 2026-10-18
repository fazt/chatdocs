"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="contenido" className="flex min-h-full flex-col items-center justify-center px-4 py-24 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-rose">error</p>
      <h1 className="mt-3 text-3xl font-medium tracking-tight">Algo salió mal</h1>
      <p className="mt-3 max-w-md text-muted-foreground">Ocurrió un error inesperado. Puedes reintentar; si persiste, recarga la página.</p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted-foreground">ref. {error.digest}</p>}
      <Button className="mt-8" onClick={reset}>
        Reintentar
      </Button>
    </main>
  );
}
