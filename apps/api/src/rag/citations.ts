import type { Citation, CitationQuote } from "../db/schema.js";
import { foldForMatch, truncate } from "../lib/text.js";
import type { RetrievedChunk } from "./retrieval.js";

/** Números [n] citados en la respuesta (admite [1][3] y [1, 3]). */
export function citedNumbers(answer: string): Set<number> {
  const used = new Set<number>();
  for (const match of answer.matchAll(/\[(\d{1,2}(?:\s*,\s*\d{1,2})*)\]/g)) {
    for (const part of match[1]!.split(",")) used.add(Number(part.trim()));
  }
  return used;
}

/**
 * Citas textuales «…» [n] (o "…" [n]) de la respuesta, con el fragmento al que
 * apuntan. Solo se consideran las que van seguidas de una referencia.
 */
export function extractQuotes(answer: string): { text: string; n: number }[] {
  const quotes: { text: string; n: number }[] = [];
  const re = /(?:«([^»]{8,600})»|“([^”]{8,600})”|"([^"\n]{8,600})")\s*\[(\d{1,2})/g;
  for (const match of answer.matchAll(re)) {
    const text = (match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (text) quotes.push({ text, n: Number(match[4]) });
  }
  return quotes;
}

/** ¿El texto aparece literalmente (normalizado) dentro de `haystack`? Admite "…" para omisiones. */
export function quoteAppearsIn(quote: string, haystack: string): boolean {
  const folded = foldForMatch(haystack);
  const parts = foldForMatch(quote)
    .split(/\s*(?:\.\.\.|…|\[\.\.\.\]|\(\.\.\.\))\s*/)
    .map((p) => p.replace(/^[\s"'.,;:]+|[\s"'.,;:]+$/g, ""))
    .filter((p) => p.length >= 4);
  if (parts.length === 0) return false;
  let from = 0;
  for (const part of parts) {
    const at = folded.indexOf(part, from);
    if (at === -1) return false;
    from = at + part.length;
  }
  return true;
}

/**
 * Construye las citas de un mensaje: un objeto por fragmento recuperado,
 * marcando cuáles usó el modelo y VERIFICANDO cada cita literal contra el
 * texto real de la página (no contra lo que el modelo dice que dice).
 *
 * `pageText(documentId, page)` devuelve el texto de una página (o vecinas):
 * una cita puede caer en el solapamiento entre fragmentos.
 */
export async function buildCitations(
  answer: string,
  chunks: RetrievedChunk[],
  pageText: (documentId: string, page: number) => Promise<string>,
): Promise<Citation[]> {
  const used = citedNumbers(answer);
  const quotes = extractQuotes(answer);
  const citations: Citation[] = [];

  for (const [index, chunk] of chunks.entries()) {
    const n = index + 1;
    const own: CitationQuote[] = [];
    for (const quote of quotes.filter((q) => q.n === n)) {
      let verified = quoteAppearsIn(quote.text, chunk.content);
      let page: number | null = verified ? chunk.page : null;
      if (!verified) {
        // Puede estar en la página completa aunque no en el fragmento.
        const text = await pageText(chunk.documentId, chunk.page);
        if (text && quoteAppearsIn(quote.text, text)) {
          verified = true;
          page = chunk.page;
        }
      }
      own.push({ text: quote.text, verified, page });
    }
    citations.push({
      n,
      chunkId: chunk.id,
      documentId: chunk.documentId,
      documentTitle: chunk.documentTitle,
      documentKind: chunk.documentKind,
      page: chunk.page,
      heading: chunk.heading,
      excerpt: truncate(chunk.content, 420),
      score: Math.round(chunk.score * 10_000) / 10_000,
      used: used.has(n),
      quotes: own,
    });
  }
  return citations;
}

/** Resumen para la interfaz: cuántas citas literales se verificaron. */
export function verificationSummary(citations: Citation[]): { quotes: number; verified: number } {
  const all = citations.flatMap((c) => c.quotes);
  return { quotes: all.length, verified: all.filter((q) => q.verified).length };
}
