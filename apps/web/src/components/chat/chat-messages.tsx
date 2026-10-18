"use client";

import { useEffect, useRef } from "react";
import { ChatMessage } from "./chat-message";
import { Spinner } from "@/components/ui/spinner";
import { useChatStore } from "@/stores/chat-store";

export function ChatMessages() {
  const { messages, isStreaming, streamingContent, streamingSources, loadingMessages, error } =
    useChatStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  if (loadingMessages) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner size={24} className="text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive max-w-md">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {messages.map((msg) => (
        <ChatMessage
          key={msg.id}
          role={msg.role as "user" | "assistant"}
          content={msg.content}
          sources={msg.sources}
        />
      ))}

      {isStreaming && streamingContent && (
        <ChatMessage
          role="assistant"
          content={streamingContent}
          sources={streamingSources}
        />
      )}

      {isStreaming && !streamingContent && (
        <div className="flex gap-3 px-4 py-6">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
            <div className="flex gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground animate-bounce [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground animate-bounce [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
          <div className="bg-secondary text-secondary-foreground rounded-2xl rounded-bl-md px-4 py-2.5 text-sm text-muted-foreground">
            Thinking...
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
