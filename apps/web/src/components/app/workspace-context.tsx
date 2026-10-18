"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError } from "@/lib/api";
import type { WorkspaceDetail } from "@/types";

interface WorkspaceState {
  id: string;
  detail: WorkspaceDetail | null;
  error: string | null;
  reload: () => Promise<void>;
  canEdit: boolean;
  isOwner: boolean;
}

const Ctx = createContext<WorkspaceState | null>(null);

export function WorkspaceProvider({ id, children }: { id: string; children: ReactNode }) {
  const [detail, setDetail] = useState<WorkspaceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setDetail(await api<WorkspaceDetail>(`/workspaces/${id}`));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 404 ? "Este espacio no existe o no tienes acceso." : "No se pudo cargar el espacio.");
    }
  }, [id]);

  useEffect(() => {
    setDetail(null);
    void reload();
  }, [reload]);

  const role = detail?.workspace.role;
  return (
    <Ctx.Provider value={{ id, detail, error, reload, canEdit: role === "owner" || role === "editor", isOwner: role === "owner" }}>{children}</Ctx.Provider>
  );
}

export function useWorkspace(): WorkspaceState {
  const value = useContext(Ctx);
  if (!value) throw new Error("useWorkspace fuera de WorkspaceProvider");
  return value;
}
