"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Download, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ErrorBox } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { api, download, errorMessage } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import type { ExtractionField } from "@/types";

interface Detail {
  extraction: { id: string; name: string; status: "queued" | "running" | "done" | "failed"; error: string | null; fields: ExtractionField[]; createdAt: string };
  documents: { id: string; title: string; kind: string }[];
  results: { documentId: string; fieldKey: string; value: string; quote: string | null; page: number | null; verified: boolean; found: boolean }[];
}

export default function ExtractionDetailPage() {
  const { ws, id } = useParams<{ ws: string; id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<Detail>(`/workspaces/${ws}/extractions/${id}`));
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [ws, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const running = data && (data.extraction.status === "queued" || data.extraction.status === "running");
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => void load(), 3000);
    return () => clearInterval(timer);
  }, [running, load]);

  if (error) return <div className="p-6"><ErrorBox message={error} onRetry={load} /></div>;
  if (!data) return <div className="flex justify-center py-20"><Spinner size={20} /></div>;

  const cell = (docId: string, key: string) => data.results.find((r) => r.documentId === docId && r.fieldKey === key);

  return (
    <div className="px-4 py-6 sm:px-6 lg:py-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link href={`/app/${ws}/extracciones`} className="rounded p-1 text-muted-foreground hover:bg-secondary" aria-label="Volver">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">{data.extraction.name}</h1>
          <p className="text-xs text-muted-foreground">
            {data.documents.length} documentos · {data.extraction.fields.length} campos · {formatRelative(data.extraction.createdAt)}
            {running && " · procesando…"}
          </p>
        </div>
        <Button variant="outline" disabled={!!running} onClick={() => download(`/workspaces/${ws}/extractions/${id}/export`, "extraccion.csv").catch((e) => toast.error(errorMessage(e)))}>
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>
      {data.extraction.status === "failed" && <ErrorBox message={data.extraction.error ?? "La extracción falló"} />}

      <div className="overflow-x-auto rounded-xl border border-border/80 bg-card">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="bg-muted/60 text-left">
              <th scope="col" className="sticky left-0 z-10 w-56 border-b border-r border-border bg-muted px-3 py-2 font-medium">
                Campo
              </th>
              {data.documents.map((doc) => (
                <th key={doc.id} scope="col" className="min-w-64 border-b border-border px-3 py-2 font-medium">
                  {doc.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.extraction.fields.map((field) => (
              <tr key={field.key} className="align-top">
                <th scope="row" className="sticky left-0 z-10 border-b border-r border-border bg-card px-3 py-3 text-left font-medium">
                  {field.label}
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{field.instructions}</span>
                </th>
                {data.documents.map((doc) => {
                  const r = cell(doc.id, field.key);
                  return (
                    <td key={doc.id} className="border-b border-border px-3 py-3">
                      {!r ? (
                        running ? <Spinner size={12} className="text-muted-foreground" /> : <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="space-y-2">
                          <p className={r.found ? "" : "text-muted-foreground"}>{r.value}</p>
                          {r.quote && (
                            <Link
                              href={`/app/${ws}/documentos/${doc.id}?pagina=${r.page ?? 1}&cita=${encodeURIComponent(r.quote.slice(0, 300))}`}
                              className="block rounded-md border border-dashed border-border bg-ink/40 p-2 text-xs text-muted-foreground hover:border-cream-soft"
                            >
                              <span className="font-serif-italic text-[13px] text-foreground/90">«{r.quote}»</span>
                              <span className={`mt-1 flex items-center gap-1 ${r.verified ? "text-mint" : "text-rose"}`}>
                                {r.verified ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                {r.verified ? "verificada" : "no verificada"}
                                {r.page && ` · ${doc.kind === "pdf" ? "pág." : "secc."} ${r.page}`}
                              </span>
                            </Link>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
