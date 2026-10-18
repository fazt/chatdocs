"use client";

import { useEffect } from "react";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/stores/auth-store";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loaded, refresh } = useAuth();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (loaded && !user) window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }, [loaded, user]);

  if (!loaded || !user) {
    return (
      <div className="flex h-full items-center justify-center" role="status" aria-label="Cargando">
        <Spinner size={22} className="text-muted-foreground" />
      </div>
    );
  }
  return <>{children}</>;
}
