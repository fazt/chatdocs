"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/app-shell";
import { useWorkspace } from "@/components/app/workspace-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorBox, Label, Select, UsageBar } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage } from "@/lib/api";
import { formatDate, formatMoney, PLAN_LABEL } from "@/lib/format";
import type { PlanInfo } from "@/types";

interface Billing {
  plan: string;
  planExpiresAt: string | null;
  plans: PlanInfo[];
  providers: { id: string; label: string }[];
  payments: { id: string; provider: string; plan: string; status: string; chargeCents: number; chargeCurrency: string; createdAt: string }[];
}

const PAYMENT_STATUS: Record<string, string> = { pending: "Pendiente", paid: "Pagado", failed: "Fallido", refunded: "Reembolsado" };

function PlanContent() {
  const params = useSearchParams();
  const { id, detail, isOwner, reload } = useWorkspace();
  const [billing, setBilling] = useState<Billing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState("");
  const [paying, setPaying] = useState<string | null>(null);
  const highlight = params.get("elegir");

  const load = useCallback(async () => {
    try {
      const data = await api<Billing>(`/workspaces/${id}/billing`);
      setBilling(data);
      setProvider((p) => p || data.providers[0]?.id || "");
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [id]);

  useEffect(() => {
    void load();
    const result = params.get("pago");
    if (result === "ok") toast.success("Pago recibido. El plan se activa en cuanto la pasarela lo confirme.");
    if (result === "cancelado") toast.info("Pago cancelado");
    if (result === "error") toast.error("No se pudo completar el pago");
    if (result) void reload();
  }, [load, params, reload]);

  const checkout = async (plan: string) => {
    setPaying(plan);
    try {
      const data = await api<{ url: string }>(`/workspaces/${id}/billing/checkout`, { method: "POST", json: { plan, provider } });
      window.location.href = data.url;
    } catch (err) {
      toast.error(errorMessage(err));
      setPaying(null);
    }
  };

  const usage = detail?.usage;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
      <PageHeader
        title="Plan y uso"
        description={
          detail
            ? `Plan ${PLAN_LABEL[detail.workspace.plan]}${detail.workspace.planExpiresAt && detail.workspace.plan !== "free" ? ` hasta el ${formatDate(detail.workspace.planExpiresAt)}` : ""}. El uso se reinicia cada mes.`
            : undefined
        }
      />
      {error && <ErrorBox message={error} onRetry={load} />}

      {usage ? (
        <div className="mb-8 grid gap-4 rounded-xl border border-border/80 bg-card p-5 sm:grid-cols-2 lg:grid-cols-3">
          <UsageBar label="Preguntas" used={usage.used.questions} limit={usage.limits.questionsPerMonth} />
          <UsageBar label="Páginas indexadas" used={usage.used.pages} limit={usage.limits.pagesPerMonth} />
          <UsageBar label="Extracciones" used={usage.used.extractions} limit={usage.limits.extractionsPerMonth} />
          <UsageBar label="Documentos" used={usage.used.documents} limit={usage.limits.documents} />
          <UsageBar label="Personas" used={usage.used.members} limit={usage.limits.members} />
        </div>
      ) : (
        <Skeleton className="mb-8 h-32 w-full" />
      )}

      {billing && (
        <>
          {isOwner && billing.providers.length > 0 && (
            <div className="mb-4 max-w-xs">
              <Label htmlFor="provider">Método de pago</Label>
              <Select id="provider" value={provider} onChange={(e) => setProvider(e.target.value)}>
                {billing.providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {isOwner && billing.providers.length === 0 && (
            <p className="mb-4 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
              No hay pasarelas de pago configuradas. Define las claves de Stripe, PayPal o Mercado Pago en la API (o activa la simulada en desarrollo).
            </p>
          )}
          <div className="grid gap-4 md:grid-cols-3">
            {billing.plans.map((plan) => {
              const current = detail?.workspace.plan === plan.id;
              return (
                <div key={plan.id} className={`flex flex-col rounded-xl border p-5 ${highlight === plan.id ? "border-cream-soft" : current ? "border-mint/50" : "border-border/80"} bg-card`}>
                  <div className="flex items-center justify-between">
                    <h2 className="font-medium">{plan.name}</h2>
                    {current && <Badge variant="secondary">Actual</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>
                  <p className="mt-4 text-2xl font-semibold">{plan.priceCents === 0 ? "Gratis" : `${formatMoney(plan.priceCents, plan.currency)}`}</p>
                  {plan.days > 0 && <p className="text-xs text-muted-foreground">por {plan.days} días, sin renovación automática</p>}
                  <ul className="mt-4 space-y-1.5 text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint" aria-hidden />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {plan.priceCents > 0 && isOwner && (
                    <Button className="mt-5" onClick={() => checkout(plan.id)} disabled={!!paying || !provider}>
                      <CreditCard className="h-4 w-4" />
                      {paying === plan.id ? "Redirigiendo…" : current ? "Sumar 30 días" : `Pasar a ${plan.name}`}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          {!isOwner && <p className="mt-4 text-sm text-muted-foreground">Solo la persona propietaria del espacio puede cambiar el plan.</p>}

          {isOwner && billing.payments.length > 0 && (
            <>
              <h2 className="mb-2 mt-10 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Pagos</h2>
              <div className="overflow-x-auto rounded-xl border border-border/80 bg-card">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-left">
                    <tr>
                      <th className="px-4 py-2 font-medium">Fecha</th>
                      <th className="px-4 py-2 font-medium">Plan</th>
                      <th className="px-4 py-2 font-medium">Método</th>
                      <th className="px-4 py-2 font-medium">Importe</th>
                      <th className="px-4 py-2 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billing.payments.map((p) => (
                      <tr key={p.id} className="border-t border-border/70">
                        <td className="px-4 py-2">{formatDate(p.createdAt)}</td>
                        <td className="px-4 py-2">{PLAN_LABEL[p.plan]}</td>
                        <td className="px-4 py-2 capitalize">{p.provider}</td>
                        <td className="px-4 py-2">{formatMoney(p.chargeCents, p.chargeCurrency)}</td>
                        <td className="px-4 py-2">{PAYMENT_STATUS[p.status] ?? p.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function PlanPage() {
  return (
    <Suspense>
      <PlanContent />
    </Suspense>
  );
}
