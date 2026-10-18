"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GitCompareArrows, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/field";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Collection, ConversationDetail, DocumentItem } from "@/types";

/** Formulario para abrir una consulta (todo el expediente o documentos elegidos) o una comparación. */
export function NewConversation({ workspaceId, collections, defaultCollectionId }: { workspaceId: string; collections: Collection[]; defaultCollectionId?: string }) {
  const router = useRouter();
  const [collectionId, setCollectionId] = useState(defaultCollectionId ?? collections[0]?.id ?? "");
  const [mode, setMode] = useState<"qa" | "compare">("qa");
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!collectionId) return;
    setSelected(new Set());
    api<{ documents: DocumentItem[] }>(`/workspaces/${workspaceId}/documents?collectionId=${collectionId}&status=ready&pageSize=100`)
      .then((d) => setDocs(d.documents))
      .catch(() => setDocs([]));
  }, [collectionId, workspaceId]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (mode !== "compare" || next.size < 6) next.add(id);
      return next;
    });

  const compareInvalid = mode === "compare" && (selected.size < 2 || selected.size > 6);

  const create = async () => {
    setLoading(true);
    try {
      const data = await api<ConversationDetail>(`/workspaces/${workspaceId}/conversations`, {
        method: "POST",
        json: { collectionId, mode, documentIds: [...selected] },
      });
      router.push(`/app/${workspaceId}/chat/${data.conversation.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-border/80 bg-card p-5">
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de consulta">
        {[
          { id: "qa" as const, label: "Preguntar", hint: "Respuestas con citas", icon: MessageSquarePlus },
          { id: "compare" as const, label: "Comparar", hint: "2 a 6 documentos", icon: GitCompareArrows },
        ].map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={mode === option.id}
            onClick={() => setMode(option.id)}
            className={cn(
              "flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors",
              mode === option.id ? "border-cream-soft/60 bg-cream-soft/10" : "border-border hover:bg-secondary/50",
            )}
          >
            <option.icon className="mt-0.5 h-4 w-4 shrink-0 text-cream-soft" aria-hidden />
            <span>
              <span className="block text-sm font-medium">{option.label}</span>
              <span className="block text-xs text-muted-foreground">{option.hint}</span>
            </span>
          </button>
        ))}
      </div>

      <div>
        <Label htmlFor="nc-collection">Expediente</Label>
        <Select id="nc-collection" value={collectionId} onChange={(e) => setCollectionId(e.target.value)}>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.documentCount})
            </option>
          ))}
        </Select>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-xs font-medium text-muted-foreground">
          {mode === "compare" ? "Documentos a comparar" : "Limitar a documentos (opcional: si no eliges, se usa todo el expediente)"}
        </legend>
        {docs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">No hay documentos listos en este expediente.</p>
        ) : (
          <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border p-1.5">
            {docs.map((doc) => (
              <li key={doc.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary/60">
                  <input type="checkbox" checked={selected.has(doc.id)} onChange={() => toggle(doc.id)} className="accent-current" />
                  <span className="truncate">{doc.title}</span>
                  <span className="ml-auto shrink-0 font-mono text-[10px] uppercase text-muted-foreground">{doc.kind}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <Button className="w-full" onClick={create} disabled={loading || !collectionId || docs.length === 0 || compareInvalid}>
        {loading ? "Abriendo…" : mode === "compare" ? `Comparar ${selected.size} documentos` : "Empezar consulta"}
      </Button>
    </div>
  );
}
