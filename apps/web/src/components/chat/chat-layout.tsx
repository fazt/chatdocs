"use client";

import { ChatSidebar } from "./chat-sidebar";
import { ChatMessages } from "./chat-messages";
import { ChatInput } from "./chat-input";
import { ChatWelcome } from "./chat-welcome";
import { useChatStore } from "@/stores/chat-store";

export function ChatLayout() {
  const { activeConversationId } = useChatStore();

  return (
    <div className="flex h-full">
      <ChatSidebar />
      <main className="flex flex-1 flex-col min-w-0">
        {activeConversationId ? (
          <>
            <div className="flex-1 flex flex-col min-h-0">
              <ChatMessages />
            </div>
            <ChatInput />
          </>
        ) : (
          <ChatWelcome />
        )}
      </main>
    </div>
  );
}
