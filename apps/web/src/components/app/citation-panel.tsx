"use client";

import Link from "next/link";
import { CheckCircle2, ExternalLink, FileText, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { locationLabel } from "@/lib/format";
import type { Citation } from "@/types";

/** Detalle de una fuente: ubicación, citas literales con su verificación y acceso al visor. */
export function CitationPanel({ workspaceId, citation, onClose }: { workspaceId: string; citation: Citation; onClose: () => void }) {
  const quote = citation.quotes[0]?.text;
  const viewerHref = `/app/${workspaceId}/documentos/${citation.documentId}?pagina=${citation.page}${quote ? `&cita=${encodeURIComponent(quote.slice(0, 300))}` : ""}`;
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-border/70 p-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-widest text-cream-soft">Fuente [{citation.n}]</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-medium">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate">{citation.documentTitle}</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{locationLabel(citation.documentKind, citation.page, citation.heading)}</p>
        </div>
        <button onClick={onClose} aria-label="Cerrar fuente" className="rounded p-1 text-muted-foreground hover:bg-secondary">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {citation.quotes.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Citas literales en la respuesta</p>
            {citation.quotes.map((q, i) => (
              <figure
                key={i}
                className={`rounded-lg border p-3 text-sm ${q.verified ? "border-mint/40 bg-mint/5" : "border-rose/40 bg-rose/5"}`}
              >
                <blockquote className="font-serif-italic text-[15px] leading-snug">«{q.text}»</blockquote>
                <figcaption className={`mt-2 flex items-center gap-1.5 text-xs ${q.verified ? "text-mint" : "text-rose"}`}>
                  {q.verified ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                  {q.verified ? "Verificada: el texto aparece en el documento" : "No verificada: no se encontró literalmente; revisa la fuente"}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Fragmento recuperado</p>
          <p className="whitespace-pre-wrap rounded-lg border border-dashed border-border bg-ink/50 p-3 font-mono text-[12px] leading-relaxed text-muted-foreground">
            {citation.excerpt}
          </p>
        </div>
      </div>
      <div className="border-t border-border/70 p-4">
        <Link href={viewerHref}>
          <Button className="w-full" variant="outline">
            <ExternalLink className="h-4 w-4" />
            Abrir en la página del documento
          </Button>
        </Link>
      </div>
    </div>
  );
}
