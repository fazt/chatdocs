"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Save } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/components/app/workspace-context";
import { Button } from "@/components/ui/button";
import { ErrorBox, Label, Textarea } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { api, download, errorMessage } from "@/lib/api";
import { formatBytes, formatDate } from "@/lib/format";
import type { DocumentItem, DocumentMetadata } from "@/types";

interface PageText {
  number: number;
  heading: string | null;
  text: string;
}

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

/**
 * Resalta `needle` dentro de `text` sin romper el texto original: busca sobre
 * una versión "plegada" (sin tildes ni mayúsculas, espacios colapsados) y
 * mapea las posiciones al texto real.
 */
function highlight(text: string, needle: string | null): React.ReactNode {
  if (!needle || needle.length < 4) return text;
  const map: number[] = [];
  let folded = "";
  let lastSpace = false;
  for (let i = 0; i < text.length; i++) {
    const ch = fold(text[i]!);
    if (/\s/.test(ch)) {
      if (lastSpace) continue;
      folded += " ";
      map.push(i);
      lastSpace = true;
    } else {
      for (const c of ch) {
        folded += c;
        map.push(i);
      }
      lastSpace = false;
    }
  }
  const target = fold(needle).replace(/\s+/g, " ").replace(/^[«"“\s]+|[»"”\s.]+$/g, "").trim();
  const at = folded.indexOf(target);
  if (at === -1 || !target) return text;
  const start = map[at]!;
  const end = (map[at + target.length - 1] ?? text.length - 1) + 1;
  return (
    <>
      {text.slice(0, start)}
      <mark className="cite" id="cita">
        {text.slice(start, end)}
      </mark>
      {text.slice(end)}
    </>
  );
}

const FIELDS: { key: keyof DocumentMetadata; label: string; legal?: boolean; research?: boolean }[] = [
  { key: "parties", label: "Partes", legal: true },
  { key: "signedAt", label: "Fecha de firma", legal: true },
  { key: "reference", label: "Referencia / norma", legal: true },
  { key: "authors", label: "Autores", research: true },
  { key: "year", label: "Año", research: true },
  { key: "doi", label: "DOI", research: true },
];

function Viewer() {
  const { ws, docId } = useParams<{ ws: string; docId: string }>();
  const params = useSearchParams();
  const { canEdit } = useWorkspace();
  const initialPage = Math.max(1, Number(params.get("pagina") ?? 1) || 1);
  const quote = params.get("cita");
  const [doc, setDoc] = useState<DocumentItem | null>(null);
  const [page, setPage] = useState(initialPage);
  const [pages, setPages] = useState<PageText[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<DocumentMetadata>({});
  const [title, setTitle] = useState("");

  useEffect(() => {
    api<{ document: DocumentItem }>(`/workspaces/${ws}/documents/${docId}`)
      .then(({ document }) => {
        setDoc(document);
        setMeta(document.metadata ?? {});
        setTitle(document.title);
      })
      .catch((err) => setError(errorMessage(err)));
  }, [ws, docId]);

  const loadPage = useCallback(async () => {
    setPages(null);
    try {
      // La página pedida y sus vecinas (la cita puede caer en el borde).
      const from = Math.max(1, page - 1);
      const data = await api<{ pages: PageText[] }>(`/workspaces/${ws}/documents/${docId}/pages?from=${from}&to=${page + 1}`);
      setPages(data.pages);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [ws, docId, page]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    if (pages) setTimeout(() => document.getElementById("cita")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  }, [pages]);

  const isPdf = doc?.kind === "pdf";
  const unit = isPdf ? "Página" : "Sección";
  const total = doc?.pageCount ?? 1;
  const visible = useMemo(() => pages?.filter((p) => p.number === page) ?? [], [pages, page]);

  const saveMeta = async () => {
    try {
      const data = await api<{ document: DocumentItem }>(`/workspaces/${ws}/documents/${docId}`, { method: "PATCH", json: { title, metadata: meta } });
      setDoc((d) => (d ? { ...d, ...data.document } : d));
      toast.success("Datos guardados");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (error) return <div className="p-6"><ErrorBox message={error} /></div>;

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_300px] lg:py-8">
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Link href={`/app/${ws}/documentos`} className="rounded p-1 text-muted-foreground hover:bg-secondary" aria-label="Volver a documentos">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{doc?.title ?? "…"}</h1>
          <Button size="sm" variant="outline" onClick={() => download(`/workspaces/${ws}/documents/${docId}/file`, doc?.originalName ?? "documento").catch((e) => toast.error(errorMessage(e)))}>
            <Download className="h-3.5 w-3.5" /> Original
          </Button>
        </div>

        <div className="mb-3 flex items-center justify-between gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label={`${unit} anterior`}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <form
            className="flex items-center gap-2 text-sm"
            onSubmit={(e) => {
              e.preventDefault();
              const value = Number(new FormData(e.currentTarget).get("p"));
              if (value >= 1 && value <= total) setPage(value);
            }}
          >
            <label htmlFor="goto">{unit}</label>
            <Input id="goto" name="p" type="number" min={1} max={total} defaultValue={page} key={page} className="h-8 w-20 text-center" />
            <span className="text-muted-foreground">de {total}</span>
          </form>
          <Button size="sm" variant="outline" disabled={page >= total} onClick={() => setPage((p) => p + 1)} aria-label={`${unit} siguiente`}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <article className="min-h-[50vh] rounded-xl border border-border/80 bg-card p-5 sm:p-8">
          {pages === null ? (
            <div className="flex justify-center py-20">
              <Spinner size={20} className="text-muted-foreground" />
            </div>
          ) : visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">Esta {unit.toLowerCase()} no tiene texto.</p>
          ) : (
            visible.map((p) => (
              <div key={p.number}>
                <p className="mb-4 font-mono text-[11px] uppercase tracking-widest text-cream-soft">
                  {unit} {p.number}
                  {p.heading ? ` · ${p.heading}` : ""}
                </p>
                <div className="whitespace-pre-wrap font-serif text-[15.5px] leading-[1.75]">{highlight(p.text, quote)}</div>
              </div>
            ))
          )}
        </article>
      </div>

      <aside className="space-y-4">
        {doc && (
          <div className="space-y-2 rounded-xl border border-border/80 bg-card p-4 text-sm">
            <p className="flex justify-between"><span className="text-muted-foreground">Archivo</span><span className="truncate pl-2">{doc.originalName}</span></p>
            <p className="flex justify-between"><span className="text-muted-foreground">Tamaño</span><span>{formatBytes(doc.sizeBytes)}</span></p>
            <p className="flex justify-between"><span className="text-muted-foreground">{isPdf ? "Páginas" : "Secciones"}</span><span>{doc.pageCount}</span></p>
            <p className="flex justify-between"><span className="text-muted-foreground">Fragmentos</span><span>{doc.chunkCount}</span></p>
            <p className="flex justify-between"><span className="text-muted-foreground">Subido</span><span>{formatDate(doc.createdAt)}</span></p>
          </div>
        )}
        <div className="space-y-3 rounded-xl border border-border/80 bg-card p-4">
          <p className="text-sm font-medium">Ficha del documento</p>
          <div>
            <Label htmlFor="doc-title">Título</Label>
            <Input id="doc-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit} />
          </div>
          {FIELDS.map((field) => (
            <div key={field.key}>
              <Label htmlFor={`m-${field.key}`}>{field.label}</Label>
              <Input id={`m-${field.key}`} value={meta[field.key] ?? ""} onChange={(e) => setMeta((m) => ({ ...m, [field.key]: e.target.value }))} disabled={!canEdit} />
            </div>
          ))}
          <div>
            <Label htmlFor="m-notes">Notas</Label>
            <Textarea id="m-notes" rows={3} value={meta.notes ?? ""} onChange={(e) => setMeta((m) => ({ ...m, notes: e.target.value }))} disabled={!canEdit} />
          </div>
          {canEdit && (
            <Button size="sm" className="w-full" onClick={saveMeta} disabled={!title.trim()}>
              <Save className="h-3.5 w-3.5" /> Guardar ficha
            </Button>
          )}
        </div>
      </aside>
    </div>
  );
}

export default function DocumentViewerPage() {
  return (
    <Suspense>
      <Viewer />
    </Suspense>
  );
}
