"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { useWorkspace, WorkspaceProvider } from "@/components/app/workspace-context";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/field";

function Guard({ children }: { children: React.ReactNode }) {
  const { error } = useWorkspace();
  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20">
        <EmptyState
          title={error}
          action={
            <Link href="/app">
              <Button variant="outline">Ir a mis espacios</Button>
            </Link>
          }
        />
      </div>
    );
  }
  return <>{children}</>;
}

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { ws } = useParams<{ ws: string }>();
  return (
    <WorkspaceProvider id={ws}>
      <AppShell workspaceId={ws}>
        <Guard>{children}</Guard>
      </AppShell>
    </WorkspaceProvider>
  );
}
