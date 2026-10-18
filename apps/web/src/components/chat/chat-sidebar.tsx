"use client";

import { useEffect, useState } from "react";
import { Plus, MessageSquare, Trash2, Menu, X, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useChatStore } from "@/stores/chat-store";
import { useAuthStore } from "@/stores/auth-store";
import { DocumentList } from "@/components/documents/document-list";
import { CompactFileUploader } from "@/components/documents/file-uploader";
import { cn } from "@/lib/utils";

export function ChatSidebar() {
  const {
    conversations,
    activeConversationId,
    loadingConversations,
    fetchConversations,
    selectConversation,
    createConversation,
    deleteConversation,
    resetActiveConversation,
  } = useChatStore();
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleNewChat = async () => {
    await createConversation();
    setIsOpen(false);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteConversation(id);
  };

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-3 left-3 z-50 flex h-9 w-9 items-center justify-center rounded-lg bg-card border md:hidden"
      >
        {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed md:static inset-y-0 left-0 z-40 flex w-72 flex-col border-r bg-card transition-transform md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full md:relative md:w-72"
        )}
      >
        {/* Header */}
        <div className="p-3 border-b">
          <Button
            onClick={handleNewChat}
            className="w-full justify-start gap-2"
            variant="secondary"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          <p className="px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
            Conversations
          </p>

          {loadingConversations ? (
            <div className="space-y-1 px-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-8 w-5/6" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="px-2 py-4 text-xs text-center text-muted-foreground">
              No conversations yet
            </p>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => {
                  selectConversation(conv.id);
                  setIsOpen(false);
                }}
                className={cn(
                  "group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  conv.id === activeConversationId
                    ? "bg-secondary text-secondary-foreground"
                    : "hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
                )}
              >
                <MessageSquare className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{conv.title}</span>
                <button
                  onClick={(e) => handleDelete(e, conv.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-destructive transition-opacity"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </button>
            ))
          )}
        </div>

        {/* Documents section */}
        <div className="border-t p-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
            Documents
          </p>
          <CompactFileUploader />
          <DocumentList />
        </div>

        {/* User section */}
        <div className="border-t p-3 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium truncate">{user?.name || user?.email}</p>
            <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
          </div>
          <button
            onClick={async () => { await logout(); router.push("/auth"); }}
            className="p-1.5 hover:bg-secondary rounded-lg transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </aside>
    </>
  );
}
