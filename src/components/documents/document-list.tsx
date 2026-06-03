"use client";

import { useEffect } from "react";
import { FileText, ImageIcon, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocumentsStore } from "@/stores/documents-store";
import { toast } from "sonner";
import type { Document } from "@/types";

export function DocumentList() {
  const { documents, loading, fetchDocuments, deleteDocument } =
    useDocumentsStore();

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleDelete = async (doc: Document) => {
    await deleteDocument(doc.id);
    toast.success(`"${doc.filename}" deleted`);
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-3/4" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-6">
        <FileText className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">No documents yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-secondary/50 transition-colors"
        >
          {doc.type === "image" ? (
            <div className="h-8 w-8 shrink-0 rounded overflow-hidden bg-muted">
              {doc.url ? (
                <img src={doc.url} alt={doc.filename} className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-4 w-4 text-muted-foreground m-2" />
              )}
            </div>
          ) : (
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs truncate">{doc.filename}</p>
            <p className="text-[10px] text-muted-foreground">
              {doc.type === "image" ? "image" : `${doc.chunkCount} chunks`}
            </p>
          </div>
          <button
            onClick={() => handleDelete(doc)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/20 rounded"
          >
            <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      ))}
    </div>
  );
}
