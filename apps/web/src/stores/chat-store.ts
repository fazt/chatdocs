"use client";

import { create } from "zustand";
import type { Conversation, Message, SourceInfo } from "@/types";
import { api } from "@/lib/client";

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
  streamingSources: SourceInfo[];
  error: string | null;
  loadingConversations: boolean;
  loadingMessages: boolean;

  fetchConversations: () => Promise<void>;
  createConversation: (documentIds?: string[]) => Promise<string | null>;
  selectConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  abortStream: () => void;
  appendDelta: (content: string) => void;
  finishStream: (sources: SourceInfo[]) => void;
  setStreamError: (message: string) => void;
  resetActiveConversation: () => void;
}

let abortController: AbortController | null = null;

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  isStreaming: false,
  streamingContent: "",
  streamingSources: [],
  error: null,
  loadingConversations: false,
  loadingMessages: false,

  fetchConversations: async () => {
    set({ loadingConversations: true, error: null });
    try {
      const res = await api("/conversations");
      if (!res.ok) throw new Error("Failed to fetch conversations");
      const data = await res.json();
      set({ conversations: data.conversations, loadingConversations: false });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      set({
        error: err instanceof Error ? err.message : "Failed to fetch conversations",
        loadingConversations: false,
      });
    }
  },

  createConversation: async (documentIds?: string[]) => {
    try {
      const res = await api("/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New Chat",
          documentIds: documentIds || [],
        }),
      });
      if (!res.ok) throw new Error("Failed to create conversation");
      const data = await res.json();
      const conv = data.conversation;

      set((state) => ({
        conversations: [conv, ...state.conversations],
        activeConversationId: conv.id,
        messages: [],
        streamingContent: "",
        streamingSources: [],
        error: null,
      }));

      return conv.id;
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to create conversation",
      });
      return null;
    }
  },

  selectConversation: async (id: string) => {
    set({ loadingMessages: true, error: null, activeConversationId: id });
    try {
      const res = await api(`/conversations/${id}`);
      if (!res.ok) throw new Error("Failed to load conversation");
      const data = await res.json();

      const parsedMessages = (data.messages || []).map((m: Message) => ({
        ...m,
        sources: typeof m.sources === "string" ? JSON.parse(m.sources) : m.sources,
      }));

      set({
        messages: parsedMessages,
        loadingMessages: false,
        streamingContent: "",
        streamingSources: [],
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load conversation",
        loadingMessages: false,
      });
    }
  },

  deleteConversation: async (id: string) => {
    try {
      await api(`/conversations/${id}`, { method: "DELETE" });
      set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== id),
        activeConversationId:
          state.activeConversationId === id ? null : state.activeConversationId,
        messages: state.activeConversationId === id ? [] : state.messages,
      }));
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to delete conversation",
      });
    }
  },

  sendMessage: async (message: string) => {
    const { activeConversationId, messages } = get();
    if (!activeConversationId) return;

    if (abortController) {
      abortController.abort();
    }
    abortController = new AbortController();

    const tempMsg: Message = {
      id: "temp-" + Date.now(),
      conversationId: activeConversationId,
      role: "user",
      content: message,
      tokenCount: 0,
      createdAt: new Date().toISOString(),
    };

    set({
      messages: [...messages, tempMsg],
      isStreaming: true,
      streamingContent: "",
      streamingSources: [],
      error: null,
    });

    try {
      const res = await fetch(`${BASE}/chat/${activeConversationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
        signal: abortController.signal,
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to send message");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === "delta") {
              get().appendDelta(event.content);
            } else if (event.type === "done") {
              get().finishStream(event.sources || []);
            } else if (event.type === "error") {
              get().setStreamError(event.message);
            }
          } catch {
            // Skip malformed events
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        set({ isStreaming: false, error: null });
        return;
      }
      set({
        error: err instanceof Error ? err.message : "Failed to send message",
        isStreaming: false,
      });
    }
  },

  abortStream: () => {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    set({ isStreaming: false });
  },

  appendDelta: (content: string) => {
    set((state) => ({
      streamingContent: state.streamingContent + content,
    }));
  },

  finishStream: (sources: SourceInfo[]) => {
    const { activeConversationId, messages, streamingContent } = get();

    const assistantMsg: Message = {
      id: "stream-" + Date.now(),
      conversationId: activeConversationId || "",
      role: "assistant",
      content: streamingContent,
      sources,
      tokenCount: 0,
      createdAt: new Date().toISOString(),
    };

    set({
      messages: [...messages, assistantMsg],
      isStreaming: false,
      streamingContent: "",
      streamingSources: sources,
    });

    get().fetchConversations();
  },

  setStreamError: (message: string) => {
    set({ error: message, isStreaming: false });
  },

  resetActiveConversation: () => {
    set({
      activeConversationId: null,
      messages: [],
      streamingContent: "",
      streamingSources: [],
      error: null,
    });
  },
}));
