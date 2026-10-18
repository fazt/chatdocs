import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { unprocessable } from "../lib/errors.js";
import { normalizeText } from "../lib/text.js";

export type DocumentKind = "pdf" | "docx" | "markdown" | "text";

/**
 * Una "página" de Folio: la página real en un PDF, o una sección (por
 * encabezado) en DOCX/Markdown/TXT. Es la unidad que se cita.
 */
export interface Page {
  number: number;
  heading: string | null;
  text: string;
}

export const MIME_BY_KIND: Record<DocumentKind, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  markdown: "text/markdown; charset=utf-8",
  text: "text/plain; charset=utf-8",
};

const isPdf = (buf: Buffer) => buf.subarray(0, 5).toString("latin1") === "%PDF-";
const isZip = (buf: Buffer) => buf.subarray(0, 4).toString("hex") === "504b0304";

/** Texto UTF-8 válido y sin bytes nulos (descarta binarios renombrados). */
function decodeText(buf: Buffer): string | null {
  if (buf.subarray(0, 8192).includes(0)) return null;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf).replace(/^﻿/, "");
  } catch {
    return null;
  }
}

/**
 * Tipo REAL por contenido (no por el Content-Type del navegador). Si la
 * extensión no coincide con los bytes (un .exe renombrado a .pdf) se rechaza.
 */
export function detectKind(buf: Buffer, fileName: string): DocumentKind {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (buf.length === 0) throw unprocessable("El archivo está vacío");
  if (isPdf(buf)) {
    if (ext !== "pdf") throw unprocessable("El contenido es un PDF pero la extensión no coincide");
    return "pdf";
  }
  if (isZip(buf)) {
    if (ext === "docx" && buf.includes(Buffer.from("word/"))) return "docx";
    throw unprocessable("Formato no admitido: sube PDF, DOCX, Markdown o TXT");
  }
  if (ext === "pdf" || ext === "docx") throw unprocessable(`El archivo no es un ${ext.toUpperCase()} válido`);
  if (decodeText(buf) === null) throw unprocessable("Formato no admitido o archivo binario");
  if (["md", "markdown", "mdx"].includes(ext)) return "markdown";
  if (["txt", "text"].includes(ext)) return "text";
  throw unprocessable(`Extensión .${ext} no admitida: sube PDF, DOCX, Markdown o TXT`);
}

async function extractPdf(buf: Buffer, maxPages: number): Promise<Page[]> {
  let texts: string[];
  let total: number;
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    total = pdf.numPages;
    if (total > maxPages) throw unprocessable(`El PDF tiene ${total} páginas; el máximo por documento es ${maxPages}`);
    const result = await extractText(pdf, { mergePages: false });
    texts = result.text as unknown as string[];
  } catch (error) {
    if (error instanceof Error && error.name === "HttpError") throw error;
    throw unprocessable(`No se pudo leer el PDF: ${error instanceof Error ? error.message : String(error)}`);
  }
  // Se conservan TODAS las páginas (también las vacías) para que la numeración
  // coincida con la del PDF original al citar.
  const pages = texts.map((text, i) => ({ number: i + 1, heading: null, text: normalizeText(text ?? "") }));
  if (!pages.some((p) => p.text)) {
    throw unprocessable("El PDF no contiene texto extraíble (¿es un escaneo? pásalo por OCR antes de subirlo)");
  }
  return pages;
}

/** Markdown / texto con encabezados → una sección por encabezado #, ## o ###. */
export function splitByHeadings(source: string): Page[] {
  const pages: Page[] = [];
  let heading: string | null = null;
  let lines: string[] = [];
  let inFence = false;
  const flush = () => {
    const text = normalizeText(lines.join("\n"));
    if (text) pages.push({ number: pages.length + 1, heading, text });
    lines = [];
  };
  for (const line of source.replace(/\r\n?/g, "\n").split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    const match = !inFence ? /^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(line) : null;
    if (match) {
      flush();
      heading = match[2]!.slice(0, 200);
    }
    lines.push(line);
  }
  flush();
  return pages;
}

/** Texto plano sin encabezados: secciones de ~6000 caracteres partidas por párrafo. */
function splitPlain(text: string, target = 6000): Page[] {
  const paragraphs = normalizeText(text).split(/\n{2,}/);
  const pages: Page[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length > target) {
      pages.push({ number: pages.length + 1, heading: null, text: current });
      current = "";
    }
    current = current ? `${current}\n\n${paragraph}` : paragraph;
  }
  if (current) pages.push({ number: pages.length + 1, heading: null, text: current });
  return pages;
}

/** DOCX → Markdown (mammoth conserva los encabezados) → secciones. */
async function extractDocx(buf: Buffer): Promise<Page[]> {
  try {
    const { value } = await mammoth.convertToMarkdown({ buffer: buf });
    const sections = splitByHeadings(value.replace(/\\([.()[\]#*_-])/g, "$1"));
    return sections.length > 1 ? sections : splitPlain(value);
  } catch {
    throw unprocessable("No se pudo leer el DOCX");
  }
}

export async function extractPages(buf: Buffer, kind: DocumentKind, maxPages: number): Promise<Page[]> {
  let pages: Page[];
  switch (kind) {
    case "pdf":
      return extractPdf(buf, maxPages);
    case "docx":
      pages = await extractDocx(buf);
      break;
    case "markdown":
      pages = splitByHeadings(decodeText(buf) ?? "");
      break;
    default: {
      const text = decodeText(buf) ?? "";
      const sections = splitByHeadings(text);
      pages = sections.length > 1 ? sections : splitPlain(text);
    }
  }
  if (pages.length === 0) throw unprocessable("El documento no contiene texto");
  if (pages.length > maxPages) throw unprocessable(`El documento tiene ${pages.length} secciones; el máximo es ${maxPages}`);
  return pages;
}
