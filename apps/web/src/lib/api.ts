/**
 * Cliente del API. Todo va al mismo origen (`/api/...`): en desarrollo Next
 * reescribe hacia la API y en producción lo hace nginx, así la cookie de
 * sesión httpOnly viaja sola (no hay tokens en JavaScript ni en localStorage).
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly details?: { path: string; message: string }[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Json = Record<string, unknown> | unknown[];

export async function api<T = unknown>(path: string, init: Omit<RequestInit, "body"> & { json?: Json; body?: BodyInit } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.json);
  }
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { ...init, headers, body, credentials: "same-origin" });
  } catch {
    throw new ApiError(0, "No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.");
  }
  if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/auth/")) {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
  }
  const data = res.headers.get("content-type")?.includes("application/json") ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    const err = (data ?? {}) as { error?: string; code?: string; details?: { path: string; message: string }[] };
    throw new ApiError(res.status, err.error ?? `Error ${res.status}`, err.code, err.details);
  }
  return data as T;
}

/** Mensaje legible de cualquier error. */
export const errorMessage = (error: unknown): string =>
  error instanceof ApiError
    ? error.details?.length
      ? error.details.map((d) => d.message).join(" · ")
      : error.message
    : error instanceof Error
      ? error.message
      : "Algo salió mal";

/**
 * Descarga un archivo autenticado (exportaciones, originales). Se usa fetch
 * con la cookie y un Blob, en vez de un enlace suelto, para poder mostrar
 * errores (403, 404) en la interfaz.
 */
export async function download(path: string, fallbackName: string): Promise<void> {
  const res = await fetch(`/api${path}`, { credentials: "same-origin" });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, err.error ?? "No se pudo descargar");
  }
  const disposition = res.headers.get("content-disposition") ?? "";
  const match = /filename\*=UTF-8''([^;]+)/.exec(disposition);
  const name = match ? decodeURIComponent(match[1]!) : fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export interface SseEvent {
  event: string;
  data: string;
}

/**
 * Lee un stream SSE de una respuesta de fetch (POST con cookie: EventSource no
 * permite cuerpo). El búfer conserva los eventos partidos entre lecturas.
 */
export async function* readSse(response: Response): AsyncGenerator<SseEvent> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      yield* drain();
    }
    buffer += decoder.decode();
    buffer += "\n\n";
    yield* drain();
  } finally {
    reader.releaseLock();
  }

  function* drain(): Generator<SseEvent> {
    const normalized = buffer.replace(/\r\n/g, "\n");
    const blocks = normalized.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      if (!block.trim()) continue;
      let event = "message";
      const data: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
      }
      yield { event, data: data.join("\n") };
    }
  }
}
