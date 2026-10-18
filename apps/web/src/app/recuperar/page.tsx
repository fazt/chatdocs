"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorBox, Label } from "@/components/ui/field";
import { api, errorMessage } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await api<{ message: string }>("/auth/forgot-password", { method: "POST", json: { email } });
      setSent(data.message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Recupera tu contraseña"
      subtitle="Te enviaremos un enlace que caduca en 1 hora."
      footer={
        <Link href="/login" className="hover:text-foreground">
          ← Volver a iniciar sesión
        </Link>
      }
    >
      {sent ? (
        <p role="status" className="rounded-lg border border-mint/40 bg-mint/10 p-4 text-sm">
          {sent}
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {error && <ErrorBox message={error} />}
          <Button type="submit" className="w-full" disabled={loading || !email}>
            {loading ? "Enviando…" : "Enviar enlace"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
