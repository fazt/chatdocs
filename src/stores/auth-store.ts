"use client";

import { create } from "zustand";
import { api } from "@/lib/client";

interface User {
  id: string;
  email: string;
  name: string;
  role?: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  checkAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name?: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  error: null,

  checkAuth: async () => {
    try {
      const res = await api("/auth/me");
      const data = await res.json();
      set({ user: data.user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },

  login: async (email: string, password: string) => {
    set({ error: null, loading: true });
    try {
      const res = await api("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        set({ error: data.error, loading: false });
        return false;
      }
      set({ user: data.user, loading: false });
      return true;
    } catch {
      set({ error: "Network error", loading: false });
      return false;
    }
  },

  register: async (email: string, password: string, name?: string) => {
    set({ error: null, loading: true });
    try {
      const res = await api("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        set({ error: data.error, loading: false });
        return false;
      }
      set({ user: data.user, loading: false });
      return true;
    } catch {
      set({ error: "Network error", loading: false });
      return false;
    }
  },

  logout: async () => {
    await api("/auth/logout", { method: "POST" });
    set({ user: null });
  },
}));
