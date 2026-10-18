"use client";

import { create } from "zustand";
import { api } from "@/lib/api";
import type { User, WorkspaceSummary } from "@/types";

interface AuthState {
  user: User | null;
  workspaces: WorkspaceSummary[];
  loaded: boolean;
  /** Carga la sesión desde la API (la cookie es httpOnly: JS nunca ve el token). */
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  workspaces: [],
  loaded: false,
  refresh: async () => {
    try {
      const data = await api<{ user: User | null; workspaces: WorkspaceSummary[] }>("/auth/me");
      set({ user: data.user, workspaces: data.workspaces, loaded: true });
    } catch {
      set({ user: null, workspaces: [], loaded: true });
    }
  },
  logout: async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    set({ user: null, workspaces: [] });
  },
}));
