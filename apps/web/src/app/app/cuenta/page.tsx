"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/stores/auth-store";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border/80 bg-card p-5">
      <h2 className="mb-4 font-medium">{title}</h2>
      {children}
    </section>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const { user, workspaces, refresh } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [wsName, setWsName] = useState("");
  const [deletePw, setDeletePw] = useState("");

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api("/auth/me", { method: "PATCH", json: { name } });
      await refresh();
      toast.success("Nombre actualizado");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api("/auth/change-password", { method: "POST", json: pw });
      setPw({ currentPassword: "", newPassword: "" });
      toast.success("Contraseña cambiada. Se cerraron tus otras sesiones.");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const createWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await api<{ workspace: { id: string } }>("/workspaces", { method: "POST", json: { name: wsName } });
      await refresh();
      router.push(`/app/${data.workspace.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const deleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirm("Se borrará tu cuenta y los espacios donde eres la única persona propietaria, con todos sus documentos. ¿Continuar?")) return;
    try {
      await api("/auth/me", { method: "DELETE", json: { password: deletePw } });
      window.location.href = "/";
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <AppShell workspaceId={workspaces[0]?.id}>
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
        <PageHeader title="Mi cuenta" description={user?.email} />

        <Section title="Perfil">
          <form onSubmit={saveName} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </div>
            <Button type="submit" disabled={!name.trim()}>
              Guardar
            </Button>
          </form>
        </Section>

        <Section title="Contraseña">
          <form onSubmit={changePassword} className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="cur">Actual</Label>
              <Input id="cur" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="new">Nueva</Label>
              <Input id="new" type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
            </div>
            <Button type="submit" className="sm:col-span-2 sm:justify-self-end" disabled={!pw.currentPassword || pw.newPassword.length < 10}>
              Cambiar contraseña
            </Button>
          </form>
        </Section>

        <Section title="Nuevo espacio de trabajo">
          <form onSubmit={createWorkspace} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label htmlFor="ws">Nombre</Label>
              <Input id="ws" value={wsName} onChange={(e) => setWsName(e.target.value)} placeholder="Ej.: Área legal — Grupo Andino" maxLength={80} />
            </div>
            <Button type="submit" disabled={wsName.trim().length < 2}>
              Crear
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">Cada espacio tiene su propio plan, miembros y documentos.</p>
        </Section>

        <Section title="Eliminar cuenta">
          <form onSubmit={deleteAccount} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label htmlFor="del">Confirma con tu contraseña</Label>
              <Input id="del" type="password" autoComplete="current-password" value={deletePw} onChange={(e) => setDeletePw(e.target.value)} />
            </div>
            <Button type="submit" variant="destructive" disabled={!deletePw}>
              Eliminar
            </Button>
          </form>
        </Section>
      </div>
    </AppShell>
  );
}
