"use client";

import { useCallback, useEffect, useState } from "react";
import { History } from "lucide-react";
import { PageHeader } from "@/components/app/app-shell";
import { useWorkspace } from "@/components/app/workspace-context";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorBox } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

interface Entry {
  id: string;
  action: string;
  targetType: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
}

const ACTIONS: Record<string, string> = {
  "workspace.created": "creó el espacio",
  "workspace.renamed": "renombró el espacio",
  "member.invited": "invitó a un miembro",
  "member.joined": "se unió al espacio",
  "member.role_changed": "cambió un rol",
  "member.removed": "quitó a un miembro",
  "invitation.revoked": "revocó una invitación",
  "collection.created": "creó un expediente",
  "collection.updated": "editó un expediente",
  "collection.deleted": "borró un expediente",
  "document.uploaded": "subió un documento",
  "document.updated": "editó la ficha de un documento",
  "document.deleted": "borró un documento",
  "document.downloaded": "descargó un original",
  "document.reindexed": "reindexó un documento",
  "conversation.created": "abrió una consulta",
  "conversation.deleted": "borró una consulta",
  "conversation.exported": "exportó una consulta",
  "extraction.created": "creó una extracción",
  "extraction.exported": "exportó una extracción",
  "extraction.deleted": "borró una extracción",
  "billing.checkout_started": "inició un pago",
  "billing.plan_activated": "activó un plan",
  "billing.refunded": "recibió un reembolso",
};

/** Detalle legible de la entrada (solo campos conocidos: nunca contenido de documentos). */
function detailOf(entry: Entry): string | null {
  const m = entry.meta;
  const parts = [m.title, m.name, m.email, m.role, m.plan, m.format].filter((v): v is string => typeof v === "string");
  return parts.length ? parts.join(" · ") : null;
}

export default function ActivityPage() {
  const { id } = useWorkspace();
  const [items, setItems] = useState<Entry[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (before?: string) => {
      try {
        const data = await api<{ items: Entry[]; nextCursor: string | null }>(`/workspaces/${id}/audit${before ? `?before=${encodeURIComponent(before)}` : ""}`);
        setItems((prev) => (before ? [...(prev ?? []), ...data.items] : data.items));
        setCursor(data.nextCursor);
      } catch (err) {
        setError(errorMessage(err));
      }
    },
    [id],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:py-8">
      <PageHeader title="Actividad" description="Bitácora de auditoría: quién subió, consultó, exportó o borró qué y cuándo. No guarda el contenido de las preguntas." />
      {error && <ErrorBox message={error} onRetry={() => load()} />}
      {items === null ? (
        <Skeleton className="h-64 w-full" />
      ) : items.length === 0 ? (
        <EmptyState icon={<History className="h-8 w-8" />} title="Sin actividad todavía" />
      ) : (
        <ol className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/80 bg-card">
          {items.map((entry) => (
            <li key={entry.id} className="flex flex-col gap-0.5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:gap-4">
              <time className="shrink-0 font-mono text-xs text-muted-foreground sm:w-36" dateTime={entry.createdAt}>
                {formatDateTime(entry.createdAt)}
              </time>
              <p className="min-w-0 flex-1">
                <strong className="font-medium">{entry.userName ?? "Sistema"}</strong> {ACTIONS[entry.action] ?? entry.action}
                {detailOf(entry) && <span className="text-muted-foreground"> — {detailOf(entry)}</span>}
              </p>
            </li>
          ))}
        </ol>
      )}
      {cursor && (
        <Button variant="ghost" className="mt-3 w-full" onClick={() => load(cursor)}>
          Ver más
        </Button>
      )}
    </div>
  );
}
