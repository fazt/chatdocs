"use client";

import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorBox } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage } from "@/lib/api";
import { formatDate, formatMoney, formatNumber, PLAN_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/auth-store";

interface Stats {
  users: number;
  workspaces: number;
  paidWorkspaces: number;
  documents: number;
  pagesIndexed: number;
  documentsByStatus: { status: string; n: number }[];
  usageThisMonth: { questions: number; pages: number; extractions: number };
  revenue30d: { currency: string; cents: number; n: number }[];
  ai: { llm: { provider: string; model: string }; embeddings: { provider: string; model: string }; demo: boolean };
}

type Tab = "usuarios" | "espacios" | "pagos";

export default function AdminPage() {
  const { user, workspaces } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [tab, setTab] = useState<Tab>("usuarios");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Stats>("/admin/stats").then(setStats).catch((err) => setError(errorMessage(err)));
  }, []);

  const load = useCallback(async () => {
    setRows(null);
    try {
      const path = tab === "usuarios" ? "users" : tab === "espacios" ? "workspaces" : "payments";
      const data = await api<Record<string, unknown>>(`/admin/${path}?page=${page}&pageSize=25${q ? `&q=${encodeURIComponent(q)}` : ""}`);
      setRows(data[path] as Record<string, unknown>[]);
      setTotal(data.total as number);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [tab, page, q]);

  useEffect(() => {
    const t = setTimeout(() => void load(), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const patchUser = async (id: string, body: Record<string, unknown>) => {
    try {
      await api(`/admin/users/${id}`, { method: "PATCH", json: body });
      toast.success("Usuario actualizado");
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const refund = async (id: string) => {
    if (!confirm("¿Reembolsar este pago completo? Se descuentan los días del plan.")) return;
    try {
      await api(`/admin/payments/${id}/refund`, { method: "POST" });
      toast.success("Reembolso solicitado");
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (user?.role !== "admin") {
    return (
      <AppShell workspaceId={workspaces[0]?.id}>
        <div className="p-10">
          <EmptyState title="Solo para administradores" />
        </div>
      </AppShell>
    );
  }

  const cards = stats
    ? [
        { label: "Usuarios", value: formatNumber(stats.users) },
        { label: "Espacios (pagados)", value: `${formatNumber(stats.workspaces)} (${stats.paidWorkspaces})` },
        { label: "Documentos", value: formatNumber(stats.documents) },
        { label: "Páginas indexadas", value: formatNumber(stats.pagesIndexed) },
        { label: "Preguntas este mes", value: formatNumber(stats.usageThisMonth.questions) },
        {
          label: "Ingresos 30 días",
          value: stats.revenue30d.length ? stats.revenue30d.map((r) => formatMoney(r.cents, r.currency)).join(" + ") : "—",
        },
      ]
    : [];

  return (
    <AppShell workspaceId={workspaces[0]?.id}>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
        <PageHeader
          title="Administración"
          description={stats ? `IA: ${stats.ai.llm.provider} (${stats.ai.llm.model}) · embeddings ${stats.ai.embeddings.provider}${stats.ai.demo ? " · MODO DEMO" : ""}` : undefined}
        />
        {error && <ErrorBox message={error} />}
        <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-6">
          {stats
            ? cards.map((card) => (
                <div key={card.label} className="rounded-xl border border-border/80 bg-card p-4">
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  <p className="mt-1 truncate text-lg font-semibold">{card.value}</p>
                </div>
              ))
            : [0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5" role="tablist">
            {(["usuarios", "espacios", "pagos"] as Tab[]).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => {
                  setTab(t);
                  setPage(1);
                }}
                className={cn("rounded-md px-3 py-1.5 text-sm capitalize", tab === t ? "bg-secondary font-medium" : "text-muted-foreground")}
              >
                {t}
              </button>
            ))}
          </div>
          {tab !== "pagos" && (
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input aria-label="Buscar" placeholder="Buscar…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="pl-9" />
            </div>
          )}
        </div>

        <div className="overflow-x-auto rounded-xl border border-border/80 bg-card">
          {rows === null ? (
            <Skeleton className="h-48 w-full" />
          ) : rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Sin resultados</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {tab === "usuarios" &&
                  rows.map((r) => (
                    <tr key={String(r.id)} className="border-b border-border/70 last:border-0">
                      <td className="px-4 py-2.5">
                        <p className="font-medium">{String(r.name)}</p>
                        <p className="text-xs text-muted-foreground">{String(r.email)}</p>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{String(r.workspaces)} espacios · {formatDate(String(r.createdAt))}</td>
                      <td className="px-4 py-2.5 text-xs">{r.disabledAt ? <span className="text-destructive">Desactivado</span> : r.role === "admin" ? "Admin" : "Usuario"}</td>
                      <td className="px-4 py-2.5 text-right">
                        {r.id !== user?.id && (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => patchUser(String(r.id), { role: r.role === "admin" ? "user" : "admin" })}>
                              {r.role === "admin" ? "Quitar admin" : "Hacer admin"}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => patchUser(String(r.id), { disabled: !r.disabledAt })}>
                              {r.disabledAt ? "Reactivar" : "Desactivar"}
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                {tab === "espacios" &&
                  rows.map((r) => (
                    <tr key={String(r.id)} className="border-b border-border/70 last:border-0">
                      <td className="px-4 py-2.5 font-medium">{String(r.name)}</td>
                      <td className="px-4 py-2.5">{PLAN_LABEL[String(r.plan)]}{r.planExpiresAt ? ` · hasta ${formatDate(String(r.planExpiresAt))}` : ""}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{String(r.members)} personas · {String(r.documents)} documentos</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatDate(String(r.createdAt))}</td>
                    </tr>
                  ))}
                {tab === "pagos" &&
                  rows.map((r) => (
                    <tr key={String(r.id)} className="border-b border-border/70 last:border-0">
                      <td className="px-4 py-2.5">{formatDate(String(r.createdAt))}</td>
                      <td className="px-4 py-2.5 font-medium">{String(r.workspaceName)}</td>
                      <td className="px-4 py-2.5">{PLAN_LABEL[String(r.plan)]} · <span className="capitalize">{String(r.provider)}</span></td>
                      <td className="px-4 py-2.5">{formatMoney(Number(r.chargeCents), String(r.chargeCurrency))}</td>
                      <td className="px-4 py-2.5">{String(r.status)}</td>
                      <td className="px-4 py-2.5 text-right">
                        {r.status === "paid" && (
                          <Button size="sm" variant="ghost" onClick={() => refund(String(r.id))}>
                            Reembolsar
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
        {total > 25 && (
          <div className="mt-3 flex justify-center gap-3 text-sm">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <span className="self-center text-muted-foreground">
              {page} / {Math.ceil(total / 25)}
            </span>
            <Button size="sm" variant="outline" disabled={page >= Math.ceil(total / 25)} onClick={() => setPage((p) => p + 1)}>
              Siguiente
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
