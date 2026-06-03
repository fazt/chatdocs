"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileText, Image, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useDocumentsStore } from "@/stores/documents-store";
import { toast } from "sonner";

const ACCEPTED = ".md,.markdown,.jpg,.jpeg,.png,.gif,.webp";

function isValidFile(name: string): "markdown" | "image" | false {
  const lower = name.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") || lower.endsWith(".gif") || lower.endsWith(".webp")) return "image";
  return false;
}

export function FileUploader() {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { uploadDocument, uploading } = useDocumentsStore();

  const handleFile = useCallback(
    async (file: File) => {
      const type = isValidFile(file.name);
      if (!type) {
        toast.error("Only Markdown (.md) and image files (.jpg, .png, .gif, .webp) are supported.");
        return;
      }

      const maxSize = type === "image" ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
      if (file.size > maxSize) {
        toast.error(`File is too large. Maximum size is ${maxSize / 1024 / 1024}MB.`);
        return;
      }

      const doc = await uploadDocument(file);
      if (doc) {
        toast.success(`"${file.name}" uploaded${doc.chunkCount ? ` (${doc.chunkCount} chunks)` : ""}`);
      }
    },
    [uploadDocument]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleClick = () => inputRef.current?.click();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
      className={`
        relative cursor-pointer rounded-xl border-2 border-dashed p-8
        transition-colors duration-200
        ${
          isDragging
            ? "border-primary bg-primary/10"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        }
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={handleInputChange}
      />

      <div className="flex flex-col items-center gap-3 text-center">
        {uploading ? (
          <>
            <Spinner size={32} className="text-primary" />
            <div>
              <p className="text-sm font-medium">Uploading...</p>
              <p className="text-xs text-muted-foreground">
                Processing file with AI
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
              <Upload className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">
                Drop your file here
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Markdown or images — up to 10MB
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function CompactFileUploader() {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { uploadDocument, uploading } = useDocumentsStore();

  const handleFile = useCallback(
    async (file: File) => {
      const type = isValidFile(file.name);
      if (!type) {
        toast.error("Unsupported file type.");
        return;
      }
      const maxSize = type === "image" ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
      if (file.size > maxSize) {
        toast.error(`File too large. Max ${maxSize / 1024 / 1024}MB.`);
        return;
      }
      const doc = await uploadDocument(file);
      if (doc) toast.success(`"${file.name}" uploaded`);
    },
    [uploadDocument]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleClick = () => inputRef.current?.click();

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      className={`
        flex items-center gap-2 rounded-lg border-2 border-dashed p-3
        text-xs cursor-pointer transition-colors
        ${
          isDragging
            ? "border-primary bg-primary/10"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        }
      `}
    >
      <input ref={inputRef} type="file" accept={ACCEPTED} className="hidden" onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
        if (inputRef.current) inputRef.current.value = "";
      }} />
      {uploading ? (
        <Spinner size={14} />
      ) : (
        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
      )}
      <span className="text-muted-foreground">
        {uploading ? "Uploading..." : "Upload .md or image"}
      </span>
    </div>
  );
}
