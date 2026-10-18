"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { GitCompareArrows, MessageSquare, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/app-shell";
import { NewConversation } from "@/components/app/new-conversation";
import { useWorkspace } from "@/components/app/workspace-context";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorBox, UsageBar } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import type { Collection, Conversation } from "@/types";

export default function ConversationsPage() {
  const { id, detail } = useWorkspace();
  const [collections, setCollections] = useState<Collection[] | null>(null);
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [c, list] = await Promise.all([
        api<{ collections: Collection[] }>(`/workspaces/${id}/collections`),
        api<{ conversations: Conversation[]; nextCursor: string | null }>(`/workspaces/${id}/conversations`),
      ]);
      setCollections(c.collections);
      setConversations(list.conversations);
      setCursor(list.nextCursor);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const more = async () => {
    if (!cursor) return;
    const list = await api<{ conversations: Conversation[]; nextCursor: string | null }>(`/workspaces/${id}/conversations?before=${encodeURIComponent(cursor)}`);
    setConversations((prev) => [...(prev ?? []), ...list.conversations]);
    setCursor(list.nextCursor);
  };

  const remove = async (conversation: Conversation) => {
    if (!confirm(`¿Borrar «${conversation.title}»? No se puede deshacer.`)) return;
    try {
      await api(`/workspaces/${id}/conversations/${conversation.id}`, { method: "DELETE" });
      setConversations((prev) => prev?.filter((c) => c.id !== conversation.id) ?? null);
      toast.success("Conversación borrada");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const collectionName = (cid: string | null) => collections?.find((c) => c.id === cid)?.name ?? "—";
  const totalDocs = collections?.reduce((acc, c) => acc + c.documentCount, 0) ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
      <PageHeader title={detail?.workspace.name ?? "Consultas"} description="Pregunta a un expediente o compara documentos. Cada respuesta trae sus fuentes." />
      {error && <ErrorBox message={error} onRetry={load} />}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section aria-labelledby="recientes">
          <h2 id="recientes" className="mb-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Conversaciones recientes
          </h2>
          {conversations === null ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <EmptyState icon={<MessageSquare className="h-8 w-8" />} title="Todavía no hay conversaciones">
              {totalDocs === 0 ? "Empieza subiendo un documento al expediente." : "Abre una consulta con el formulario."}
            </EmptyState>
          ) : (
            <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/80 bg-card">
              {conversations.map((conversation) => (
                <li key={conversation.id} className="group flex items-center gap-3 px-4 py-3 hover:bg-secondary/40">
                  {conversation.mode === "compare" ? (
                    <GitCompareArrows className="h-4 w-4 shrink-0 text-rose" aria-label="Comparación" />
                  ) : (
                    <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <Link href={`/app/${id}/chat/${conversation.id}`} className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{conversation.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {collectionName(conversation.collectionId)} · {formatRelative(conversation.updatedAt)}
                    </span>
                  </Link>
                  <button
                    onClick={() => remove(conversation)}
                    className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                    aria-label={`Borrar ${conversation.title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {cursor && (
            <Button variant="ghost" className="mt-3 w-full" onClick={more}>
              Cargar más
            </Button>
          )}
        </section>

        <aside className="space-y-4">
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Nueva consulta</h2>
          {collections === null ? (
            <Skeleton className="h-72 w-full" />
          ) : totalDocs === 0 ? (
            <EmptyState
              icon={<Upload className="h-7 w-7" />}
              title="Sube tu primer documento"
              action={
                <Link href={`/app/${id}/documentos`}>
                  <Button>Ir a documentos</Button>
                </Link>
              }
            >
              PDF, DOCX, Markdown o TXT.
            </EmptyState>
          ) : (
            <NewConversation workspaceId={id} collections={collections} />
          )}
          {detail && (
            <div className="space-y-3 rounded-xl border border-border/80 bg-card p-4">
              <UsageBar label="Preguntas este mes" used={detail.usage.used.questions} limit={detail.usage.limits.questionsPerMonth} />
              <UsageBar label="Páginas indexadas" used={detail.usage.used.pages} limit={detail.usage.limits.pagesPerMonth} />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
