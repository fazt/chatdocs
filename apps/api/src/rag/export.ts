import type { Citation } from "../db/schema.js";
import { locationLabel } from "./prompt.js";

interface ExportMessage {
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  status: string;
  createdAt: Date;
}

interface ExportDetail {
  conversation: { title: string; mode: "qa" | "compare"; createdAt: Date };
  messages: ExportMessage[];
  documents: { title: string }[];
}

interface ExportMeta {
  workspaceName: string;
  exportedBy: string;
  model: string;
}

const fmtDate = (d: Date) =>
  d.toLocaleString("es", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }) + " UTC";

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Fuentes citadas (solo las usadas en la respuesta, o todas si el modelo no marcó ninguna). */
function citedSources(citations: Citation[]): Citation[] {
  const used = citations.filter((c) => c.used);
  return used.length ? used : citations;
}

export function exportConversationMarkdown(detail: ExportDetail, meta: ExportMeta): string {
  const lines: string[] = [
    `# ${detail.conversation.title}`,
    "",
    `- Espacio: ${meta.workspaceName}`,
    `- Exportado por: ${meta.exportedBy} · ${fmtDate(new Date())}`,
    `- Modo: ${detail.conversation.mode === "compare" ? "comparación de documentos" : "preguntas y respuestas"}`,
    `- Modelo: ${meta.model}`,
    ...(detail.documents.length ? [`- Documentos: ${detail.documents.map((d) => d.title).join("; ")}`] : []),
    "",
    "> Las citas marcadas con ✔ se verificaron literalmente contra el texto del documento. Las respuestas son de apoyo y no constituyen asesoría legal.",
    "",
  ];
  for (const message of detail.messages) {
    if (message.role === "user") {
      lines.push(`## Pregunta`, "", message.content, "");
      continue;
    }
    lines.push(`### Respuesta${message.status === "aborted" ? " (interrumpida)" : ""}`, "", message.content, "");
    const sources = citedSources(message.citations);
    if (sources.length) {
      lines.push("**Fuentes**", "");
      for (const source of sources) {
        lines.push(`- [${source.n}] ${source.documentTitle}, ${locationLabel(source.documentKind, source.page, source.heading)}`);
        for (const quote of source.quotes) lines.push(`  - ${quote.verified ? "✔ verificada" : "✘ no verificada"}: «${quote.text}»`);
        if (source.quotes.length === 0) lines.push(`  > ${source.excerpt.replace(/\n+/g, " ")}`);
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}

/** Markdown mínimo → HTML (negritas, cursivas, listas, tablas, párrafos). Todo el texto se escapa antes. */
function renderMarkdown(md: string): string {
  const inline = (text: string) =>
    escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>")
      .replace(/_(.+?)_/g, "<em>$1</em>")
      .replace(/\[(\d{1,2})\]/g, '<sup class="ref">[$1]</sup>');
  const out: string[] = [];
  const lines = md.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? "")) {
      const cells = (row: string) => row.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
      out.push("<table><thead><tr>" + cells(line).map((h) => `<th>${inline(h)}</th>`).join("") + "</tr></thead><tbody>");
      i += 2;
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i]!)) {
        out.push("<tr>" + cells(lines[i]!).map((cell) => `<td>${inline(cell)}</td>`).join("") + "</tr>");
        i++;
      }
      i--;
      out.push("</tbody></table>");
    } else if (/^\s*[-*]\s+/.test(line)) {
      out.push("<ul>");
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i]!)) out.push(`<li>${inline(lines[i++]!.replace(/^\s*[-*]\s+/, ""))}</li>`);
      i--;
      out.push("</ul>");
    } else if (/^#{1,6}\s/.test(line)) {
      out.push(`<h4>${inline(line.replace(/^#{1,6}\s+/, ""))}</h4>`);
    } else if (line.trim()) {
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  return out.join("\n");
}

export function exportConversationHtml(detail: ExportDetail, meta: ExportMeta): string {
  const blocks = detail.messages
    .map((message) => {
      if (message.role === "user") return `<section class="q"><h2>Pregunta</h2><p>${escapeHtml(message.content)}</p></section>`;
      const sources = citedSources(message.citations)
        .map((s) => {
          const quotes = s.quotes
            .map((q) => `<li class="${q.verified ? "ok" : "ko"}">${q.verified ? "✔ verificada" : "✘ no verificada"}: «${escapeHtml(q.text)}»</li>`)
            .join("");
          return `<li><strong>[${s.n}] ${escapeHtml(s.documentTitle)}</strong>, ${escapeHtml(locationLabel(s.documentKind, s.page, s.heading))}${
            quotes ? `<ul>${quotes}</ul>` : `<blockquote>${escapeHtml(s.excerpt)}</blockquote>`
          }</li>`;
        })
        .join("");
      return `<section class="a"><h3>Respuesta${message.status === "aborted" ? " (interrumpida)" : ""}</h3>${renderMarkdown(message.content)}${
        sources ? `<div class="sources"><h4>Fuentes</h4><ol>${sources}</ol></div>` : ""
      }</section>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(detail.conversation.title)} · Folio</title>
<style>
  body{font:15px/1.6 Georgia,"Times New Roman",serif;color:#1c1917;max-width:780px;margin:40px auto;padding:0 20px}
  header{border-bottom:1px solid #d6d3d1;margin-bottom:24px;padding-bottom:12px}
  header p{font:13px/1.5 system-ui,sans-serif;color:#57534e;margin:2px 0}
  h1{font-size:26px;margin:0 0 8px} h2,h3,h4{font-family:system-ui,sans-serif}
  h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#78716c;margin:28px 0 4px}
  h3{font-size:15px;margin:16px 0 6px} .q p{font-size:17px;font-weight:600}
  .sources{border-top:1px dashed #d6d3d1;margin-top:12px;font-size:13px}
  blockquote{margin:6px 0 6px 0;padding-left:10px;border-left:3px solid #e7e5e4;color:#57534e}
  li.ok{color:#166534} li.ko{color:#9a3412} sup.ref{color:#1d4ed8;font-size:11px}
  table{border-collapse:collapse;width:100%;font-size:13px;margin:10px 0} th,td{border:1px solid #d6d3d1;padding:6px 8px;text-align:left;vertical-align:top}
  .note{font:12px/1.5 system-ui,sans-serif;color:#78716c;margin-top:36px}
  @media print{body{margin:0}}
</style></head><body>
<header><h1>${escapeHtml(detail.conversation.title)}</h1>
<p>Espacio: ${escapeHtml(meta.workspaceName)} · Exportado por ${escapeHtml(meta.exportedBy)} · ${escapeHtml(fmtDate(new Date()))}</p>
<p>Modelo: ${escapeHtml(meta.model)}${detail.documents.length ? ` · Documentos: ${escapeHtml(detail.documents.map((d) => d.title).join("; "))}` : ""}</p></header>
${blocks}
<p class="note">Generado con Folio. Las citas marcadas con ✔ se verificaron literalmente contra el texto del documento. Las respuestas son de apoyo y no constituyen asesoría legal. Para guardar en PDF usa Imprimir → Guardar como PDF.</p>
</body></html>`;
}
