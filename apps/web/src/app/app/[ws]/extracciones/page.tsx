"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Plus, Table2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/app-shell";
import { useWorkspace } from "@/components/app/workspace-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorBox, Label, Select } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import type { Collection, DocumentItem, ExtractionField, ExtractionTemplate } from "@/types";

interface ExtractionRow {
  id: string;
  name: string;
  status: "queued" | "running" | "done" | "failed";
  fieldCount: number;
  documentCount: number;
  createdAt: string;
}

const STATUS: Record<ExtractionRow["status"], string> = { queued: "En cola", running: "Procesando", done: "Lista", failed: "Error" };
const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40) || "campo";

function NewExtraction({ workspaceId, onCreated }: { workspaceId: string; onCreated: (id: string) => void }) {
  const [templates, setTemplates] = useState<ExtractionTemplate[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionId, setCollectionId] = useState("");
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [templateKey, setTemplateKey] = useState("contrato");
  const [fields, setFields] = useState<ExtractionField[]>([]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api<{ templates: ExtractionTemplate[] }>(`/workspaces/${workspaceId}/extractions/templates`),
      api<{ collections: Collection[] }>(`/workspaces/${workspaceId}/collections`),
    ])
      .then(([t, c]) => {
        setTemplates(t.templates);
        setFields(t.templates[0]?.fields ?? []);
        setName(t.templates[0]?.name ?? "");
        setCollections(c.collections);
        setCollectionId(c.collections[0]?.id ?? "");
      })
      .catch((err) => toast.error(errorMessage(err)));
  }, [workspaceId]);

  useEffect(() => {
    if (!collectionId) return;
    api<{ documents: DocumentItem[] }>(`/workspaces/${workspaceId}/documents?collectionId=${collectionId}&status=ready&pageSize=100`)
      .then((d) => {
        setDocs(d.documents);
        setSelected(new Set(d.documents.slice(0, 50).map((doc) => doc.id)));
      })
      .catch(() => setDocs([]));
  }, [collectionId, workspaceId]);

  const pickTemplate = (key: string) => {
    setTemplateKey(key);
    const t = templates.find((x) => x.key === key);
    setFields(t ? t.fields : [{ key: "campo", label: "", instructions: "" }]);
    if (t) setName(t.name);
  };

  const create = async () => {
    setSaving(true);
    try {
      const data = await api<{ extraction: { id: string } }>(`/workspaces/${workspaceId}/extractions`, {
        method: "POST",
        json: { collectionId, name, templateKey, fields: fields.map((f) => ({ ...f, key: f.key || slug(f.label) })), documentIds: [...selected] },
      });
      onCreated(data.extraction.id);
    } catch (err) {
      toast.error(errorMessage(err));
      setSaving(false);
    }
  };

  const valid = name.trim() && selected.size > 0 && fields.length > 0 && fields.every((f) => f.label.trim() && f.instructions.trim().length >= 3);

  return (
    <div className="space-y-4 rounded-xl border border-border/80 bg-card p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="ex-template">Plantilla</Label>
          <Select id="ex-template" value={templateKey} onChange={(e) => pickTemplate(e.target.value)}>
            {templates.map((t) => (
              <option key={t.key} value={t.key}>
                {t.name}
              </option>
            ))}
            <option value="custom">Campos propios</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="ex-collection">Expediente</Label>
          <Select id="ex-collection" value={collectionId} onChange={(e) => setCollectionId(e.target.value)}>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="ex-name">Nombre</Label>
        <Input id="ex-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
      </div>

      <fieldset>
        <legend className="mb-1.5 text-xs font-medium text-muted-foreground">Documentos ({selected.size})</legend>
        {docs.length === 0 ? (
          <p className="text-xs text-muted-foreground">No hay documentos listos en este expediente.</p>
        ) : (
          <ul className="max-h-40 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1.5">
            {docs.map((doc) => (
              <li key={doc.id}>
                <label className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-secondary/60">
                  <input
                    type="checkbox"
                    checked={selected.has(doc.id)}
                    onChange={() =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(doc.id)) next.delete(doc.id);
                        else next.add(doc.id);
                        return next;
                      })
                    }
                  />
                  <span className="truncate">{doc.title}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-1.5 text-xs font-medium text-muted-foreground">Campos a extraer ({fields.length}/15)</legend>
        {fields.map((field, i) => (
          <div key={i} className="grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-[160px_1fr_auto]">
            <Input aria-label="Nombre del campo" placeholder="Campo" value={field.label} onChange={(e) => setFields((fs) => fs.map((f, j) => (j === i ? { ...f, label: e.target.value, key: templateKey === "custom" ? slug(e.target.value) : f.key } : f)))} />
            <Input aria-label="Qué buscar" placeholder="Qué buscar en el documento" value={field.instructions} onChange={(e) => setFields((fs) => fs.map((f, j) => (j === i ? { ...f, instructions: e.target.value } : f)))} />
            <button type="button" onClick={() => setFields((fs) => fs.filter((_, j) => j !== i))} aria-label="Quitar campo" className="justify-self-end rounded p-2 text-muted-foreground hover:bg-secondary">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        {fields.length < 15 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setFields((fs) => [...fs, { key: `campo_${fs.length + 1}`, label: "", instructions: "" }])}>
            <Plus className="h-3.5 w-3.5" /> Añadir campo
          </Button>
        )}
      </fieldset>

      <Button className="w-full" onClick={create} disabled={saving || !valid}>
        {saving ? "Creando…" : `Extraer ${fields.length} campos de ${selected.size} documentos`}
      </Button>
    </div>
  );
}

export default function ExtractionsPage() {
  const router = useRouter();
  const { id, canEdit, reload: reloadWorkspace } = useWorkspace();
  const [rows, setRows] = useState<ExtractionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows((await api<{ extractions: ExtractionRow[] }>(`/workspaces/${id}/extractions`)).extractions);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (row: ExtractionRow) => {
    if (!confirm(`¿Borrar «${row.name}»?`)) return;
    try {
      await api(`/workspaces/${id}/extractions/${row.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
      <PageHeader
        title="Extracciones"
        description="Convierte un lote de documentos en una tabla: un valor por campo y documento, con su cita literal, página y verificación."
        actions={
          canEdit && !creating && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Nueva extracción
            </Button>
          )
        }
      />
      {error && <ErrorBox message={error} onRetry={load} />}
      {creating && (
        <div className="mb-6">
          <NewExtraction
            workspaceId={id}
            onCreated={(newId) => {
              void reloadWorkspace();
              router.push(`/app/${id}/extracciones/${newId}`);
            }}
          />
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setCreating(false)}>
            Cancelar
          </Button>
        </div>
      )}
      {rows === null ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Table2 className="h-8 w-8" />} title="Aún no hay extracciones">
          Prueba la plantilla «Contrato: cláusulas clave» con tus contratos o «Ficha de lectura» con tus papers.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/80 bg-card">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3 px-4 py-3">
              <Table2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <Link href={`/app/${id}/extracciones/${row.id}`} className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{row.name}</span>
                <span className="text-xs text-muted-foreground">
                  {row.fieldCount} campos · {row.documentCount} documentos · {formatRelative(row.createdAt)}
                </span>
              </Link>
              <Badge variant={row.status === "done" ? "secondary" : row.status === "failed" ? "destructive" : "outline"}>{STATUS[row.status]}</Badge>
              {canEdit && (
                <button onClick={() => remove(row)} className="rounded p-1.5 text-muted-foreground hover:text-destructive" aria-label={`Borrar ${row.name}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
