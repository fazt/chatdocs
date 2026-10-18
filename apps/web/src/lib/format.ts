const dateFmt = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export const formatDate = (value: string | Date | null | undefined): string => (value ? dateFmt.format(new Date(value)) : "—");
export const formatDateTime = (value: string | Date | null | undefined): string => (value ? dateTimeFmt.format(new Date(value)) : "—");

export function formatRelative(value: string | Date): string {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `hace ${days} d`;
  return formatDate(value);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Centavos → "USD 19.00" (cada moneda por separado; nunca se suman distintas). */
export function formatMoney(cents: number, currency: string): string {
  const zero = ["CLP", "JPY", "PYG"].includes(currency);
  return new Intl.NumberFormat("es", { style: "currency", currency, minimumFractionDigits: zero ? 0 : 2 }).format(zero ? cents / 100 : cents / 100);
}

export const formatNumber = (n: number): string => new Intl.NumberFormat("es").format(n);

export function locationLabel(kind: string, page: number, heading?: string | null): string {
  if (kind === "pdf") return `pág. ${page}`;
  return heading ? `secc. ${page} · ${heading}` : `secc. ${page}`;
}

export const ROLE_LABEL: Record<string, string> = { owner: "Propietario", editor: "Editor", viewer: "Lector" };
export const KIND_LABEL: Record<string, string> = { legal: "Legal", compliance: "Cumplimiento", research: "Investigación", general: "General" };
export const DOC_STATUS_LABEL: Record<string, string> = { queued: "En cola", processing: "Indexando", ready: "Listo", failed: "Error" };
export const PLAN_LABEL: Record<string, string> = { free: "Gratis", pro: "Pro", team: "Equipo" };
