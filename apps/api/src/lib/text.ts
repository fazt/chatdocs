/** Normaliza el texto extraído: saltos de línea, espacios repetidos, guiones de corte. */
export function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/­/g, "")
    .replace(/[  -​]/g, " ")
    // "obliga-\nciones" → "obligaciones" (palabras cortadas al final de línea en PDFs)
    .replace(/(\p{L})-\n(\p{Ll})/gu, "$1$2")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Forma canónica para comparar citas: minúsculas, sin tildes, comillas
 * tipográficas unificadas y espacios colapsados. Así «obligación» encontrada en
 * "OBLIGACIÓN\n" cuenta como cita literal.
 */
export function foldForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[“”«»„"]/g, '"')
    .replace(/[‘’‚']/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/(\p{L})-\s+(\p{L})/gu, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
}

export const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

/** Recorta sin partir palabras. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** "contrato-arrendamiento_v2.pdf" → "Contrato arrendamiento v2". */
export function titleFromFileName(name: string): string {
  const base = name
    .split(/[\\/]/)
    .pop()!
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : "Documento sin título";
}

/** Nombre seguro para Content-Disposition (sin comillas ni saltos de línea). */
export function safeFileName(name: string, fallback = "archivo"): string {
  const clean = name.replace(/[\r\n"\\/]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 150);
  return clean || fallback;
}

export function contentDisposition(name: string): string {
  const safe = safeFileName(name);
  const ascii = safe.normalize("NFD").replace(/[^\x20-\x7e]/g, "");
  return `attachment; filename="${ascii || "archivo"}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}
