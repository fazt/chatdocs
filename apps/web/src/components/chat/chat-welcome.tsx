"use client";

import { Bot, ArrowRight } from "lucide-react";
import { FileUploader } from "@/components/documents/file-uploader";
import { Button } from "@/components/ui/button";
import { useChatStore } from "@/stores/chat-store";
import { useDocumentsStore } from "@/stores/documents-store";
import { toast } from "sonner";

export function ChatWelcome() {
  const { createConversation } = useChatStore();
  const { documents } = useDocumentsStore();

  const handleStartChatting = async () => {
    if (documents.length === 0) {
      toast.error("Upload at least one document first.");
      return;
    }

    const docIds = documents.map((d) => d.id);
    const id = await createConversation(docIds);
    if (!id) {
      toast.error("Failed to create conversation");
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-8">
        {/* Logo + Tagline */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
              <Bot className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">ChatDocs</h1>
          <p className="text-sm text-muted-foreground">
            Upload Markdown files and ask questions about their content — powered by AI.
          </p>
        </div>

        {/* Upload Zone */}
        <FileUploader />

        {/* Documents uploaded indicator + start button */}
        {documents.length > 0 && (
          <div className="space-y-3">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                {documents.length} document{documents.length > 1 ? "s" : ""} uploaded
              </p>
            </div>
            <Button onClick={handleStartChatting} className="w-full gap-2">
              Start Chatting
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Tips */}
        <div className="rounded-xl border p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Tips
          </p>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              Upload <code className="rounded bg-secondary px-1 py-0.5">.md</code> files via drag-and-drop
            </li>
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              Ask questions about the content of your documents
            </li>
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              Responses include source citations from your documents
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
