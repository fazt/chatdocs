"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorBox, Label } from "@/components/ui/field";
import { api, errorMessage } from "@/lib/api";

/** El token llega en el #fragmento (no viaja al servidor ni queda en logs); se quita de la URL al leerlo. */
function readFragmentToken(): string | null {
  const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
  if (token) window.history.replaceState(null, "", window.location.pathname);
  return token;
}

export default function ResetPasswordPage() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => setToken(readFragmentToken()), []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      await api("/auth/reset-password", { method: "POST", json: { token, password } });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title="Elige una contraseña nueva" subtitle="Al cambiarla se cierran todas tus sesiones abiertas.">
      {done ? (
        <div className="space-y-4">
          <p role="status" className="rounded-lg border border-mint/40 bg-mint/10 p-4 text-sm">
            Listo, tu contraseña cambió.
          </p>
          <Link href="/login">
            <Button className="w-full">Iniciar sesión</Button>
          </Link>
        </div>
      ) : token === null ? (
        <div className="space-y-4">
          <ErrorBox message="El enlace no es válido. Pide uno nuevo." />
          <Link href="/recuperar">
            <Button variant="outline" className="w-full">
              Pedir un enlace nuevo
            </Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="password">Contraseña nueva</Label>
            <Input id="password" type="password" autoComplete="new-password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} />
            <p className="mt-1.5 text-xs text-muted-foreground">Mínimo 10 caracteres, con letras y al menos un número.</p>
          </div>
          {error && <ErrorBox message={error} />}
          <Button type="submit" className="w-full" disabled={loading || !token || password.length < 10}>
            {loading ? "Guardando…" : "Guardar contraseña"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
