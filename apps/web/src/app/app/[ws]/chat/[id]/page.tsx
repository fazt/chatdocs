"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Download, FileText, GitCompareArrows, Send, Square } from "lucide-react";
import { toast } from "sonner";
import { CitationPanel } from "@/components/app/citation-panel";
import { useWorkspace } from "@/components/app/workspace-context";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { ErrorBox } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { api, download, errorMessage, readSse } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Citation, ConversationDetail, Message } from "@/types";

interface StreamingState {
  text: string;
  sources: { n: number; documentTitle: string; location: string }[];
}

const SUGGESTIONS: Record<"qa" | "compare", string[]> = {
  qa: ["¿Cuáles son los plazos y fechas clave?", "¿Qué obligaciones tiene cada parte?", "¿Qué penalidades o sanciones hay?"],
  compare: ["Compara plazos, renovación y terminación", "¿En qué se diferencian las obligaciones de confidencialidad?", "Compara ley aplicable y solución de controversias"],
};

function VerificationBadge({ citations }: { citations: Citation[] }) {
  const quotes = citations.flatMap((c) => c.quotes);
  if (quotes.length === 0) return null;
  const ok = quotes.filter((q) => q.verified).length;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px]", ok === quotes.length ? "border-mint/40 text-mint" : "border-rose/40 text-rose")}>
      <CheckCircle2 className="h-3 w-3" aria-hidden />
      {ok}/{quotes.length} citas verificadas
    </span>
  );
}

export default function ChatPage() {
  const { ws, id } = useParams<{ ws: string; id: string }>();
  const { reload: reloadWorkspace } = useWorkspace();
  const [data, setData] = useState<ConversationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState<StreamingState | null>(null);
  const [selected, setSelected] = useState<Citation | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<ConversationDetail>(`/workspaces/${ws}/conversations/${id}`));
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [ws, id]);

  useEffect(() => {
    void load();
    return () => controllerRef.current?.abort();
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [data?.messages.length, streaming?.text]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || streaming || !data) return;
    setInput("");
    const temp: Message = { id: `temp-${Date.now()}`, role: "user", content: message, citations: [], status: "complete", createdAt: new Date().toISOString() };
    setData((d) => (d ? { ...d, messages: [...d.messages, temp] } : d));
    setStreaming({ text: "", sources: [] });
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const res = await fetch(`/api/workspaces/${ws}/conversations/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
        credentials: "same-origin",
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "No se pudo enviar la pregunta");
      }
      for await (const event of readSse(res)) {
        const payload = JSON.parse(event.data || "{}");
        if (event.event === "sources") setStreaming((s) => (s ? { ...s, sources: payload.sources } : s));
        else if (event.event === "delta") setStreaming((s) => (s ? { ...s, text: s.text + payload.text } : s));
        else if (event.event === "error") toast.error(payload.message);
        else if (event.event === "done") {
          const saved = payload.message as Message;
          setData((d) => (d ? { ...d, messages: [...d.messages, saved] } : d));
          const used = saved.citations.find((c) => c.used);
          if (used && window.matchMedia("(min-width: 1024px)").matches) setSelected(used);
        }
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) toast.error(errorMessage(err));
    } finally {
      setStreaming(null);
      controllerRef.current = null;
      // Sincroniza con lo guardado (título automático, respuesta interrumpida) y el uso del plan.
      void load();
      void reloadWorkspace();
    }
  };

  const stop = () => controllerRef.current?.abort();

  const exportAs = async (format: "md" | "html") => {
    try {
      await download(`/workspaces/${ws}/conversations/${id}/export?format=${format}`, `folio.${format}`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const messages = data?.messages ?? [];
  const mode = data?.conversation.mode ?? "qa";
  const citationIndex = useMemo(() => new Map(messages.map((m) => [m.id, m.citations])), [messages]);

  if (error) return <div className="p-6"><ErrorBox message={error} onRetry={load} /></div>;
  if (!data) {
    return (
      <div className="flex h-full items-center justify-center" role="status" aria-label="Cargando conversación">
        <Spinner size={22} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-3 sm:px-6">
          <Link href={`/app/${ws}`} aria-label="Volver a consultas" className="rounded p-1 text-muted-foreground hover:bg-secondary">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 truncate text-sm font-semibold">
              {mode === "compare" && <GitCompareArrows className="h-4 w-4 shrink-0 text-rose" aria-label="Comparación" />}
              <span className="truncate">{data.conversation.title}</span>
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {data.documents.length ? data.documents.map((d) => d.title).join(" · ") : "Todo el expediente"} · {formatRelative(data.conversation.updatedAt)}
            </p>
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" onClick={() => exportAs("md")} disabled={messages.length === 0} title="Exportar Markdown con fuentes">
              <Download className="h-3.5 w-3.5" /> MD
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportAs("html")} disabled={messages.length === 0} title="Exportar HTML imprimible (PDF)">
              <Download className="h-3.5 w-3.5" /> PDF
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6" aria-live="polite">
          <div className="mx-auto max-w-3xl space-y-6">
            {messages.length === 0 && !streaming && (
              <div className="py-10 text-center">
                <p className="font-serif-italic text-2xl text-cream">{mode === "compare" ? "¿Qué quieres comparar?" : "¿Qué quieres saber?"}</p>
                <p className="mt-2 text-sm text-muted-foreground">Las respuestas citan el texto literal y su página.</p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS[mode].map((s) => (
                    <button key={s} onClick={() => send(s)} className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) =>
              message.role === "user" ? (
                <div key={message.id} className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-secondary px-4 py-2.5 text-sm">
                  {message.content}
                </div>
              ) : (
                <article key={message.id} className="space-y-3">
                  <Markdown
                    content={message.content}
                    validRefs={new Set(message.citations.map((c) => c.n))}
                    onCite={(n) => setSelected(citationIndex.get(message.id)?.find((c) => c.n === n) ?? null)}
                  />
                  <div className="flex flex-wrap items-center gap-1.5">
                    <VerificationBadge citations={message.citations} />
                    {message.status === "aborted" && <span className="font-mono text-[10px] text-muted-foreground">respuesta interrumpida</span>}
                    {message.citations
                      .filter((c) => c.used)
                      .map((c) => (
                        <button
                          key={c.n}
                          onClick={() => setSelected(c)}
                          className={cn(
                            "inline-flex max-w-full items-center gap-1 truncate rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                            selected?.chunkId === c.chunkId ? "border-cream-soft bg-cream-soft/15" : "border-border text-muted-foreground hover:bg-secondary",
                          )}
                        >
                          <FileText className="h-3 w-3 shrink-0" aria-hidden />
                          <span className="font-mono">[{c.n}]</span>
                          <span className="truncate">{c.documentTitle}</span>
                          <span className="shrink-0 text-muted-foreground">· {c.documentKind === "pdf" ? `pág. ${c.page}` : `secc. ${c.page}`}</span>
                        </button>
                      ))}
                  </div>
                </article>
              ),
            )}

            {streaming && (
              <article className="space-y-2">
                {streaming.text ? (
                  <Markdown content={streaming.text} />
                ) : (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Spinner size={14} /> Buscando en {streaming.sources.length || "los"} fragmentos…
                  </p>
                )}
                <span className="inline-block h-3.5 w-1.5 animate-caret bg-cream-soft align-middle" aria-hidden />
              </article>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <form
          className="border-t border-border/70 p-3 sm:p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <label htmlFor="pregunta" className="sr-only">
              Tu pregunta
            </label>
            <textarea
              id="pregunta"
              ref={textareaRef}
              value={input}
              rows={1}
              maxLength={4000}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder={mode === "compare" ? "Ej.: compara plazos de preaviso y penalidades" : "Pregunta sobre los documentos…"}
              className="max-h-44 min-h-11 flex-1 resize-none rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {streaming ? (
              <Button type="button" size="icon" variant="destructive" onClick={stop} aria-label="Detener respuesta" className="h-11 w-11">
                <Square className="h-4 w-4 fill-current" />
              </Button>
            ) : (
              <Button type="submit" size="icon" disabled={input.trim().length < 2} aria-label="Enviar pregunta" className="h-11 w-11">
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="mx-auto mt-1.5 max-w-3xl text-[11px] text-muted-foreground">Enter para enviar · Shift+Enter para salto de línea · Las respuestas son de apoyo, no asesoría legal.</p>
        </form>
      </div>

      {selected && (
        <>
          <aside className="hidden w-96 shrink-0 border-l border-border/70 bg-card lg:block">
            <CitationPanel workspaceId={ws} citation={selected} onClose={() => setSelected(null)} />
          </aside>
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Fuente">
            <div className="absolute inset-0 bg-black/50" onClick={() => setSelected(null)} />
            <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-hidden rounded-t-2xl border-t border-border bg-card">
              <CitationPanel workspaceId={ws} citation={selected} onClose={() => setSelected(null)} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
