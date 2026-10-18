"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { ErrorBox } from "@/components/ui/field";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/stores/auth-store";

const STORAGE_KEY = "folio-invitation";

/**
 * Aceptar invitación. El token llega en el #fragmento; si no hay sesión se
 * guarda en sessionStorage (solo esta pestaña) para aceptarla tras el login.
 */
export default function InvitationPage() {
  const router = useRouter();
  const { user, loaded, refresh } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let value = new URLSearchParams(window.location.hash.slice(1)).get("token");
    if (value) {
      window.history.replaceState(null, "", window.location.pathname);
      try {
        sessionStorage.setItem(STORAGE_KEY, value);
      } catch {
        // sin almacenamiento: se acepta en esta misma visita
      }
    } else {
      try {
        value = sessionStorage.getItem(STORAGE_KEY);
      } catch {
        value = null;
      }
    }
    setToken(value);
    void refresh();
  }, [refresh]);

  const accept = async () => {
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      const data = await api<{ workspaceId: string }>("/invitations/accept", { method: "POST", json: { token } });
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // nada
      }
      router.replace(`/app/${data.workspaceId}`);
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  };

  return (
    <AuthCard title="Invitación a un espacio de Folio" subtitle="Únete al equipo para ver sus expedientes y conversaciones.">
      {!token ? (
        <ErrorBox message="No encontramos la invitación. Abre de nuevo el enlace del email." />
      ) : !loaded ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : !user ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Inicia sesión o crea tu cuenta con el mismo email al que llegó la invitación.</p>
          <Link href="/login?next=/invitacion">
            <Button className="w-full">Iniciar sesión</Button>
          </Link>
          <Link href="/registro?next=/invitacion">
            <Button variant="outline" className="w-full">
              Crear cuenta
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm">
            Vas a unirte como <strong>{user.email}</strong>.
          </p>
          {error && <ErrorBox message={error} />}
          <Button className="w-full" onClick={accept} disabled={loading}>
            {loading ? "Uniéndote…" : "Aceptar invitación"}
          </Button>
        </div>
      )}
    </AuthCard>
  );
}
