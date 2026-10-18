/** Solo rutas internas para `?next=` (evita redirecciones abiertas a otros dominios). */
export function safeNext(value: string | null | undefined, fallback = "/app"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
