"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorBox, Label } from "@/components/ui/field";
import { api, errorMessage } from "@/lib/api";
import { safeNext } from "@/lib/safe-next";

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const strongEnough = form.password.length >= 10 && /[a-zA-Z]/.test(form.password) && /\d/.test(form.password);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await api<{ workspaceId: string }>("/auth/register", { method: "POST", json: form });
      const plan = params.get("plan");
      const next = params.get("next");
      router.replace(next ? safeNext(next) : plan ? `/app/${data.workspaceId}/plan?elegir=${encodeURIComponent(plan)}` : `/app/${data.workspaceId}`);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" autoComplete="name" required value={form.name} onChange={set("name")} />
      </div>
      <div>
        <Label htmlFor="email">Email de trabajo</Label>
        <Input id="email" type="email" autoComplete="email" required value={form.email} onChange={set("email")} />
      </div>
      <div>
        <Label htmlFor="password">Contraseña</Label>
        <Input id="password" type="password" autoComplete="new-password" required value={form.password} onChange={set("password")} aria-describedby="password-hint" />
        <p id="password-hint" className={`mt-1.5 text-xs ${form.password && !strongEnough ? "text-destructive" : "text-muted-foreground"}`}>
          Mínimo 10 caracteres, con letras y al menos un número.
        </p>
      </div>
      {error && <ErrorBox message={error} />}
      <Button type="submit" className="w-full" disabled={loading || !form.name || !form.email || !strongEnough}>
        {loading ? "Creando cuenta…" : "Crear cuenta"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">Plan Gratis, sin tarjeta. Se crea tu espacio personal con un primer expediente.</p>
    </form>
  );
}

export default function RegisterPage() {
  return (
    <AuthCard
      title="Crea tu cuenta"
      subtitle="Empieza a preguntar a tus documentos en minutos."
      footer={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-medium text-foreground underline-offset-2 hover:underline">
            Inicia sesión
          </Link>
        </>
      }
    >
      <Suspense>
        <RegisterForm />
      </Suspense>
    </AuthCard>
  );
}
