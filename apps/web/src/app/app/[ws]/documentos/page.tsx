"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, FileText, FolderPlus, Pencil, RefreshCw, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/app-shell";
import { useWorkspace } from "@/components/app/workspace-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorBox, Label, Select, Textarea } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { api, errorMessage } from "@/lib/api";
import { DOC_STATUS_LABEL, formatBytes, formatRelative, KIND_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Collection, DocumentItem } from "@/types";

const ACCEPT = ".pdf,.docx,.md,.markdown,.txt";
const PAGE_SIZE = 30;

function CollectionForm({ initial, onSave, onCancel }: { initial?: Collection; onSave: (v: { name: string; description: string; kind: string }) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [kind, setKind] = useState<string>(initial?.kind ?? "legal");
  const [saving, setSaving] = useState(false);
  return (
    <form
      className="space-y-3 rounded-xl border border-border/80 bg-card p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        await onSave({ name, description, kind }).finally(() => setSaving(false));
      }}
    >
      <div>
        <Label htmlFor="col-name">Nombre del expediente</Label>
        <Input id="col-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Cliente X — contratos 2026" required maxLength={120} />
      </div>
      <div>
        <Label htmlFor="col-kind">Tipo</Label>
        <Select id="col-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
          {Object.entries(KIND_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="col-desc">Descripción</Label>
        <Textarea id="col-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={600} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={saving || !name.trim()}>
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}

export default function DocumentsPage() {
  const { id, canEdit, reload: reloadWorkspace } = useWorkspace();
  const [collections, setCollections] = useState<Collection[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [docs, setDocs] = useState<DocumentItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<"new" | Collection | null>(null);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadCollections = useCallback(async () => {
    try {
      const data = await api<{ collections: Collection[] }>(`/workspaces/${id}/collections`);
      setCollections(data.collections);
      setActive((current) => current ?? data.collections[0]?.id ?? null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [id]);

  const loadDocs = useCallback(async () => {
    if (!active) return;
    try {
      const params = new URLSearchParams({ collectionId: active, page: String(page), pageSize: String(PAGE_SIZE) });
      if (query.trim()) params.set("q", query.trim());
      const data = await api<{ documents: DocumentItem[]; total: number }>(`/workspaces/${id}/documents?${params}`);
      setDocs(data.documents);
      setTotal(data.total);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [id, active, page, query]);

  useEffect(() => {
    void loadCollections();
  }, [loadCollections]);

  useEffect(() => {
    setDocs(null);
    const t = setTimeout(() => void loadDocs(), query ? 250 : 0);
    return () => clearTimeout(t);
  }, [loadDocs, query]);

  // Mientras haya documentos indexándose, se consulta su estado cada 3 s.
  const pending = docs?.some((d) => d.status === "queued" || d.status === "processing");
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => void loadDocs(), 3000);
    return () => clearInterval(timer);
  }, [pending, loadDocs]);

  const upload = async (files: FileList | File[]) => {
    if (!active || !canEdit) return;
    const list = Array.from(files);
    setUploading({ done: 0, total: list.length });
    for (const [i, file] of list.entries()) {
      const form = new FormData();
      form.set("file", file);
      form.set("collectionId", active);
      try {
        await api(`/workspaces/${id}/documents`, { method: "POST", body: form });
        toast.success(`«${file.name}» subido: indexando…`);
      } catch (err) {
        toast.error(`${file.name}: ${errorMessage(err)}`);
      }
      setUploading({ done: i + 1, total: list.length });
    }
    setUploading(null);
    setPage(1);
    await Promise.all([loadDocs(), loadCollections(), reloadWorkspace()]);
  };

  const removeDoc = async (doc: DocumentItem) => {
    if (!confirm(`¿Borrar «${doc.title}»? Se eliminan el archivo, su índice y sus citas en extracciones.`)) return;
    try {
      await api(`/workspaces/${id}/documents/${doc.id}`, { method: "DELETE" });
      toast.success("Documento borrado");
      await Promise.all([loadDocs(), loadCollections()]);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const reindex = async (doc: DocumentItem) => {
    try {
      await api(`/workspaces/${id}/documents/${doc.id}/reindex`, { method: "POST" });
      toast.success("Reindexando");
      await loadDocs();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const saveCollection = async (values: { name: string; description: string; kind: string }) => {
    try {
      if (editing === "new") {
        const data = await api<{ collection: Collection }>(`/workspaces/${id}/collections`, { method: "POST", json: values });
        setActive(data.collection.id);
      } else if (editing) {
        await api(`/workspaces/${id}/collections/${editing.id}`, { method: "PATCH", json: values });
      }
      setEditing(null);
      await loadCollections();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const deleteCollection = async (collection: Collection) => {
    if (!confirm(`¿Borrar el expediente «${collection.name}» y sus ${collection.documentCount} documentos?`)) return;
    try {
      await api(`/workspaces/${id}/collections/${collection.id}`, { method: "DELETE" });
      setActive(null);
      await loadCollections();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const current = collections?.find((c) => c.id === active);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
      <PageHeader
        title="Documentos"
        description="Organiza los documentos en expedientes (por caso, cliente o proyecto). Se indexan por página para citar con precisión."
        actions={
          canEdit && (
            <Button variant="outline" onClick={() => setEditing("new")}>
              <FolderPlus className="h-4 w-4" /> Nuevo expediente
            </Button>
          )
        }
      />
      {error && <ErrorBox message={error} onRetry={() => void loadCollections()} />}

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-3">
          {editing && <CollectionForm initial={editing === "new" ? undefined : editing} onSave={saveCollection} onCancel={() => setEditing(null)} />}
          {collections === null ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <ul className="space-y-1" aria-label="Expedientes">
              {collections.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => {
                      setActive(c.id);
                      setPage(1);
                    }}
                    aria-current={c.id === active ? "true" : undefined}
                    className={cn("w-full rounded-lg px-3 py-2 text-left transition-colors", c.id === active ? "bg-secondary" : "hover:bg-secondary/50")}
                  >
                    <span className="block truncate text-sm font-medium">{c.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {KIND_LABEL[c.kind]} · {c.documentCount} doc.
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="min-w-0 space-y-4">
          {current && (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold">{current.name}</h2>
                {current.description && <p className="text-sm text-muted-foreground">{current.description}</p>}
              </div>
              {canEdit && (
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(current)} aria-label="Editar expediente">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteCollection(current)} aria-label="Borrar expediente">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {canEdit && active && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (e.dataTransfer.files.length) void upload(e.dataTransfer.files);
              }}
              className={cn("rounded-xl border-2 border-dashed p-6 text-center transition-colors", dragging ? "border-cream-soft bg-cream-soft/10" : "border-border")}
            >
              <input ref={inputRef} type="file" accept={ACCEPT} multiple className="sr-only" id="file-input" onChange={(e) => e.target.files && void upload(e.target.files).finally(() => (e.target.value = ""))} />
              {uploading ? (
                <p className="flex items-center justify-center gap-2 text-sm">
                  <Spinner size={16} /> Subiendo {uploading.done + 1 > uploading.total ? uploading.total : uploading.done + 1} de {uploading.total}…
                </p>
              ) : (
                <>
                  <Upload className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
                  <p className="text-sm">
                    Arrastra archivos aquí o{" "}
                    <label htmlFor="file-input" className="cursor-pointer font-medium underline underline-offset-2">
                      elígelos
                    </label>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">PDF con texto, DOCX, Markdown o TXT. Los PDF escaneados necesitan OCR antes.</p>
                </>
              )}
            </div>
          )}

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              aria-label="Buscar por título"
              placeholder="Buscar por título…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>

          {docs === null ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : docs.length === 0 ? (
            <EmptyState icon={<FileText className="h-8 w-8" />} title={query ? "Sin resultados" : "Este expediente está vacío"}>
              {query ? "Prueba con otro título." : canEdit ? "Sube el primer documento arriba." : "Pide a un editor que suba documentos."}
            </EmptyState>
          ) : (
            <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/80 bg-card">
              {docs.map((doc) => (
                <li key={doc.id} className="flex items-center gap-3 px-4 py-3">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1">
                    {doc.status === "ready" ? (
                      <Link href={`/app/${id}/documentos/${doc.id}`} className="block truncate text-sm font-medium hover:underline">
                        {doc.title}
                      </Link>
                    ) : (
                      <span className="block truncate text-sm font-medium">{doc.title}</span>
                    )}
                    <span className="block truncate text-xs text-muted-foreground">
                      <span className="font-mono uppercase">{doc.kind}</span> · {formatBytes(doc.sizeBytes)}
                      {doc.pageCount > 0 && ` · ${doc.pageCount} ${doc.kind === "pdf" ? "pág." : "secc."}`} · {formatRelative(doc.createdAt)}
                    </span>
                    {doc.status === "failed" && doc.error && (
                      <span className="mt-0.5 flex items-center gap-1 text-xs text-destructive">
                        <AlertTriangle className="h-3 w-3" aria-hidden /> {doc.error}
                      </span>
                    )}
                  </div>
                  <Badge variant={doc.status === "ready" ? "secondary" : doc.status === "failed" ? "destructive" : "outline"} className="shrink-0">
                    {(doc.status === "processing" || doc.status === "queued") && <Spinner size={10} className="mr-1" />}
                    {DOC_STATUS_LABEL[doc.status]}
                  </Badge>
                  {canEdit && (
                    <div className="flex shrink-0">
                      {(doc.status === "failed" || doc.status === "ready") && (
                        <button onClick={() => reindex(doc)} className="rounded p-1.5 text-muted-foreground hover:bg-secondary" aria-label={`Reindexar ${doc.title}`} title="Reindexar">
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button onClick={() => removeDoc(doc)} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Borrar ${doc.title}`} title="Borrar">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {pages > 1 && (
            <nav className="flex items-center justify-center gap-3 text-sm" aria-label="Paginación">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <span className="text-muted-foreground">
                {page} / {pages}
              </span>
              <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                Siguiente
              </Button>
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
