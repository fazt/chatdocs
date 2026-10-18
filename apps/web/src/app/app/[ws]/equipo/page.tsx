"use client";

import { useCallback, useEffect, useState } from "react";
import { MailPlus, Pencil, UserMinus, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/app-shell";
import { useWorkspace } from "@/components/app/workspace-context";
import { Button } from "@/components/ui/button";
import { ErrorBox, Label, Select } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage } from "@/lib/api";
import { formatDate, ROLE_LABEL } from "@/lib/format";
import { useAuth } from "@/stores/auth-store";
import type { MemberRole } from "@/types";

interface Members {
  members: { userId: string; name: string; email: string; role: MemberRole; joinedAt: string }[];
  invitations: { id: string; email: string; role: MemberRole; expiresAt: string }[];
  limit: number;
}

const ROLE_HELP: Record<MemberRole, string> = {
  owner: "Todo, incluidos miembros y pagos",
  editor: "Sube y organiza documentos, crea extracciones",
  viewer: "Consulta, pregunta y exporta",
};

export default function TeamPage() {
  const { id, isOwner, detail, reload: reloadWorkspace } = useWorkspace();
  const { user, refresh } = useAuth();
  const [data, setData] = useState<Members | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("viewer");
  const [sending, setSending] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await api<Members>(`/workspaces/${id}/members`));
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await api(`/workspaces/${id}/invitations`, { method: "POST", json: { email, role } });
      toast.success(`Invitación enviada a ${email}`);
      setEmail("");
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const changeRole = async (userId: string, newRole: MemberRole) => {
    try {
      await api(`/workspaces/${id}/members/${userId}`, { method: "PATCH", json: { role: newRole } });
      toast.success("Rol actualizado");
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const removeMember = async (member: Members["members"][number]) => {
    const self = member.userId === user?.id;
    if (!confirm(self ? "¿Salir de este espacio?" : `¿Quitar a ${member.name} del espacio?`)) return;
    try {
      await api(`/workspaces/${id}/members/${member.userId}`, { method: "DELETE" });
      if (self) {
        await refresh();
        window.location.href = "/app";
        return;
      }
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const revoke = async (invitationId: string) => {
    try {
      await api(`/workspaces/${id}/invitations/${invitationId}`, { method: "DELETE" });
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const rename = async () => {
    try {
      await api(`/workspaces/${id}`, { method: "PATCH", json: { name } });
      setRenaming(false);
      await Promise.all([reloadWorkspace(), refresh()]);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const used = (data?.members.length ?? 0) + (data?.invitations.length ?? 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:py-8">
      <PageHeader
        title="Equipo"
        description={data ? `${used} de ${data.limit} lugares usados en tu plan (miembros + invitaciones pendientes).` : undefined}
        actions={
          isOwner &&
          !renaming && (
            <Button
              variant="outline"
              onClick={() => {
                setName(detail?.workspace.name ?? "");
                setRenaming(true);
              }}
            >
              <Pencil className="h-4 w-4" /> Renombrar espacio
            </Button>
          )
        }
      />
      {renaming && (
        <div className="mb-6 flex gap-2">
          <Input aria-label="Nombre del espacio" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          <Button onClick={rename} disabled={name.trim().length < 2}>
            Guardar
          </Button>
          <Button variant="ghost" onClick={() => setRenaming(false)}>
            Cancelar
          </Button>
        </div>
      )}
      {error && <ErrorBox message={error} onRetry={load} />}

      {isOwner && (
        <form onSubmit={invite} className="mb-6 grid gap-3 rounded-xl border border-border/80 bg-card p-4 sm:grid-cols-[1fr_160px_auto] sm:items-end">
          <div>
            <Label htmlFor="inv-email">Invitar por email</Label>
            <Input id="inv-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colega@estudio.pe" />
          </div>
          <div>
            <Label htmlFor="inv-role">Rol</Label>
            <Select id="inv-role" value={role} onChange={(e) => setRole(e.target.value as MemberRole)}>
              <option value="viewer">Lector</option>
              <option value="editor">Editor</option>
              <option value="owner">Propietario</option>
            </Select>
          </div>
          <Button type="submit" disabled={sending || !email || (data ? used >= data.limit : false)}>
            <MailPlus className="h-4 w-4" /> {sending ? "Enviando…" : "Invitar"}
          </Button>
          <p className="text-xs text-muted-foreground sm:col-span-3">
            {ROLE_HELP[role]}. El enlace llega solo al email invitado y caduca en 7 días.
          </p>
        </form>
      )}

      {data === null ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <>
          <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/80 bg-card">
            {data.members.map((member) => (
              <li key={member.userId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {member.name} {member.userId === user?.id && <span className="text-xs text-muted-foreground">(tú)</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {member.email} · desde {formatDate(member.joinedAt)}
                  </p>
                </div>
                {isOwner ? (
                  <Select aria-label={`Rol de ${member.name}`} value={member.role} onChange={(e) => changeRole(member.userId, e.target.value as MemberRole)} className="w-36">
                    <option value="viewer">Lector</option>
                    <option value="editor">Editor</option>
                    <option value="owner">Propietario</option>
                  </Select>
                ) : (
                  <span className="text-xs text-muted-foreground">{ROLE_LABEL[member.role]}</span>
                )}
                {(isOwner || member.userId === user?.id) && (
                  <button onClick={() => removeMember(member)} className="rounded p-1.5 text-muted-foreground hover:text-destructive" aria-label={member.userId === user?.id ? "Salir del espacio" : `Quitar a ${member.name}`}>
                    <UserMinus className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {data.invitations.length > 0 && (
            <>
              <h2 className="mb-2 mt-8 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Invitaciones pendientes</h2>
              <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/80 bg-card">
                {data.invitations.map((inv) => (
                  <li key={inv.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <span className="min-w-0 flex-1 truncate">{inv.email}</span>
                    <span className="text-xs text-muted-foreground">
                      {ROLE_LABEL[inv.role]} · caduca {formatDate(inv.expiresAt)}
                    </span>
                    <button onClick={() => revoke(inv.id)} className="rounded p-1.5 text-muted-foreground hover:text-destructive" aria-label={`Revocar invitación a ${inv.email}`}>
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
