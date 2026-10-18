"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/field";
import { useAuth } from "@/stores/auth-store";

/** /app: abre el primer espacio de trabajo de la persona. */
export default function AppHome() {
  const router = useRouter();
  const { workspaces, user } = useAuth();

  useEffect(() => {
    if (workspaces[0]) router.replace(`/app/${workspaces[0].id}`);
  }, [workspaces, router]);

  if (workspaces.length > 0) return null;
  return (
    <main id="contenido" className="mx-auto max-w-lg px-4 py-24">
      <EmptyState
        title="No perteneces a ningún espacio"
        action={
          <div className="flex gap-2">
            <Link href="/app/cuenta">
              <Button variant="outline">Mi cuenta</Button>
            </Link>
            {user?.role === "admin" && (
              <Link href="/app/admin">
                <Button>Administración</Button>
              </Link>
            )}
          </div>
        }
      >
        Crea uno desde tu cuenta o pide a tu equipo que te invite.
      </EmptyState>
    </main>
  );
}
