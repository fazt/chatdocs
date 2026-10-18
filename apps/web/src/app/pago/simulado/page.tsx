"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { ErrorBox } from "@/components/ui/field";
import { formatMoney } from "@/lib/format";

/** Solo URLs de este mismo sitio como destino de vuelta (sin redirección abierta). */
function sameOrigin(url: string | null): string {
  if (!url) return "/app";
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin ? parsed.pathname + parsed.search : "/app";
  } catch {
    return "/app";
  }
}

function SimulatedCheckout() {
  const params = useSearchParams();
  const paymentId = params.get("payment") ?? "";
  const token = params.get("t") ?? "";
  const amount = Number(params.get("amount") ?? 0);
  const currency = params.get("currency") ?? "USD";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"paid" | "failed" | null>(null);

  // Recorre el MISMO camino que una pasarela real: un webhook firmado (aquí, con el token HMAC del pago).
  const finish = async (outcome: "paid" | "failed") => {
    setLoading(outcome);
    setError(null);
    try {
      const res = await fetch("/api/billing/webhooks/simulated", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, token, outcome }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "No se pudo completar el pago");
      window.location.href = sameOrigin(outcome === "paid" ? params.get("ok") : params.get("ko"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setLoading(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-dashed border-cream-soft/50 bg-cream-soft/10 p-4 text-sm">
        Pasarela <strong>simulada</strong>: no se mueve dinero. Solo está disponible en desarrollo y demos.
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-muted-foreground">Referencia</dt>
        <dd className="text-right font-mono">{params.get("code")}</dd>
        <dt className="text-muted-foreground">Importe</dt>
        <dd className="text-right font-medium">{formatMoney(amount, currency)}</dd>
      </dl>
      {error && <ErrorBox message={error} />}
      <div className="grid gap-2">
        <Button onClick={() => finish("paid")} disabled={!!loading || !paymentId}>
          {loading === "paid" ? "Procesando…" : "Pagar (simulado)"}
        </Button>
        <Button variant="outline" onClick={() => finish("failed")} disabled={!!loading || !paymentId}>
          Simular pago rechazado
        </Button>
      </div>
    </div>
  );
}

export default function SimulatedPaymentPage() {
  return (
    <AuthCard title="Pago de prueba">
      <Suspense>
        <SimulatedCheckout />
      </Suspense>
    </AuthCard>
  );
}
