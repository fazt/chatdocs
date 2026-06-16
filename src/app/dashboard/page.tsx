"use client";

import { useEffect } from "react";
import { ChatLayout } from "@/components/chat/chat-layout";
import { useAuthStore } from "@/stores/auth-store";

export default function Home() {
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return <ChatLayout />;
}
