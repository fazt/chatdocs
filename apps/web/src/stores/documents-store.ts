"use client";

import { create } from "zustand";
import type { Document } from "@/types";
import { api } from "@/lib/client";

interface DocumentsState {
  documents: Document[];
  loading: boolean;
  uploading: boolean;
  error: string | null;

  fetchDocuments: () => Promise<void>;
  uploadDocument: (file: File) => Promise<Document | null>;
  deleteDocument: (id: string) => Promise<void>;
}

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

export const useDocumentsStore = create<DocumentsState>((set, get) => ({
  documents: [],
  loading: false,
  uploading: false,
  error: null,

  fetchDocuments: async () => {
    set({ loading: true, error: null });
    try {
      const res = await api("/documents");
      if (!res.ok) throw new Error("Failed to fetch documents");
      const data = await res.json();
      set({ documents: data.documents, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to fetch documents",
        loading: false,
      });
    }
  },

  uploadDocument: async (file: File) => {
    set({ uploading: true, error: null });
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${BASE}/documents`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to upload document");
      }

      const doc = await res.json();
      set((state) => ({
        documents: [doc, ...state.documents],
        uploading: false,
      }));
      return doc;
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to upload document",
        uploading: false,
      });
      return null;
    }
  },

  deleteDocument: async (id: string) => {
    try {
      const res = await api(`/documents/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete document");
      set((state) => ({
        documents: state.documents.filter((d) => d.id !== id),
      }));
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to delete document",
      });
    }
  },
}));
