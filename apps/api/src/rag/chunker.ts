import { estimateTokens } from "../lib/text.js";
import type { Page } from "./extract.js";

export interface RawChunk {
  page: number;
  heading: string | null;
  /** Desplazamiento del fragmento dentro del texto de su página. */
  charStart: number;
  chunkIndex: number;
  content: string;
  tokenCount: number;
}

/**
 * Fragmenta POR PÁGINA: un fragmento nunca cruza de una página a otra, así cada
 * cita apunta a una página exacta. Dentro de la página se corta por párrafos
 * (y por frases si un párrafo es enorme) con solapamiento.
 */
export function chunkPages(pages: Page[], options: { maxChars: number; overlapChars: number }): RawChunk[] {
  const { maxChars, overlapChars } = options;
  const chunks: RawChunk[] = [];

  for (const page of pages) {
    const text = page.text;
    if (!text.trim()) continue;

    // Unidades con su posición: párrafos, y frases si el párrafo no cabe.
    const units: { start: number; end: number }[] = [];
    const paragraphRe = /[^\n]+(?:\n(?!\n)[^\n]+)*/g;
    for (const match of text.matchAll(paragraphRe)) {
      const start = match.index ?? 0;
      const paragraph = match[0];
      if (paragraph.length <= maxChars) {
        units.push({ start, end: start + paragraph.length });
        continue;
      }
      const sentenceRe = /[^.;!?]+[.;!?]*\s*/g;
      for (const sentence of paragraph.matchAll(sentenceRe)) {
        const s = start + (sentence.index ?? 0);
        const e = s + sentence[0].length;
        // Frase gigantesca (tablas, texto sin puntuación): cortes duros.
        for (let cut = s; cut < e; cut += maxChars) units.push({ start: cut, end: Math.min(cut + maxChars, e) });
      }
    }
    if (units.length === 0) continue;

    let first = 0;
    while (first < units.length) {
      let last = first;
      while (last + 1 < units.length && units[last + 1]!.end - units[first]!.start <= maxChars) last++;
      const start = units[first]!.start;
      const end = units[last]!.end;
      const content = text.slice(start, end).trim();
      if (content) {
        chunks.push({
          page: page.number,
          heading: page.heading,
          charStart: start,
          chunkIndex: chunks.length,
          content,
          tokenCount: estimateTokens(content),
        });
      }
      if (last + 1 >= units.length) break;
      // Solapamiento: el siguiente fragmento arranca unas unidades antes del final.
      let next = last + 1;
      while (next - 1 > first && end - units[next - 1]!.start <= overlapChars) next--;
      first = next;
    }
  }
  return chunks;
}
