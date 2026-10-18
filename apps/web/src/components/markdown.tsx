import { Fragment, type ReactNode } from "react";

/**
 * Markdown mínimo para las respuestas del modelo: párrafos, listas, tablas,
 * negritas, cursivas, código y referencias [n] clicables. Se construye con
 * elementos de React (nunca dangerouslySetInnerHTML): el texto del modelo o de
 * los documentos no puede inyectar HTML.
 */
interface Props {
  content: string;
  onCite?: (n: number) => void;
  validRefs?: Set<number>;
}

function inline(text: string, props: Props, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[\d{1,2}(?:\s*,\s*\d{1,2})*\]|_[^_\s][^_]*_|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let i = 0;
  for (const match of text.matchAll(re)) {
    const token = match[0];
    const start = match.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const key = `${keyBase}-${i++}`;
    if (token.startsWith("**")) out.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith("`")) out.push(<code key={key}>{token.slice(1, -1)}</code>);
    else if (token.startsWith("[")) {
      const numbers = token.slice(1, -1).split(",").map((n) => Number(n.trim()));
      out.push(
        <Fragment key={key}>
          {numbers.map((n) =>
            props.onCite && (!props.validRefs || props.validRefs.has(n)) ? (
              <button
                key={n}
                type="button"
                onClick={() => props.onCite?.(n)}
                className="mx-0.5 inline-flex h-[1.15rem] min-w-[1.15rem] -translate-y-px items-center justify-center rounded border border-cream-soft/50 bg-cream-soft/10 px-1 align-middle font-mono text-[10px] font-semibold text-cream transition-colors hover:bg-cream-soft/25"
                aria-label={`Ver fuente ${n}`}
              >
                {n}
              </button>
            ) : (
              <sup key={n} className="font-mono text-[10px] text-muted-foreground">
                [{n}]
              </sup>
            ),
          )}
        </Fragment>,
      );
    } else out.push(<em key={key}>{token.slice(1, -1)}</em>);
    last = start + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const isTableRow = (line: string) => /^\s*\|.*\|\s*$/.test(line);
const isTableDivider = (line: string) => /^\s*\|[\s:|-]+\|\s*$/.test(line);
const cells = (row: string) => row.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

export function Markdown(props: Props) {
  const lines = props.content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const key = `b${i}`;
    if (isTableRow(line) && isTableDivider(lines[i + 1] ?? "")) {
      const head = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && isTableRow(lines[i]!)) rows.push(cells(lines[i++]!));
      blocks.push(
        <table key={key}>
          <thead>
            <tr>{head.map((h, j) => <th key={j}>{inline(h, props, `${key}h${j}`)}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>{row.map((cell, j) => <td key={j}>{inline(cell, props, `${key}r${r}c${j}`)}</td>)}</tr>
            ))}
          </tbody>
        </table>,
      );
      continue;
    }
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && (ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*]\s+/).test(lines[i]!)) {
        items.push(lines[i++]!.replace(ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*]\s+/, ""));
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(<List key={key}>{items.map((item, j) => <li key={j}>{inline(item, props, `${key}l${j}`)}</li>)}</List>);
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push(<h4 key={key}>{inline(heading[2]!, props, key)}</h4>);
      i++;
      continue;
    }
    if (line.trim()) {
      const para: string[] = [];
      while (i < lines.length && lines[i]!.trim() && !isTableRow(lines[i]!) && !/^\s*([-*]|\d+[.)])\s+/.test(lines[i]!) && !/^#{1,6}\s/.test(lines[i]!)) {
        para.push(lines[i++]!);
      }
      blocks.push(<p key={key}>{inline(para.join(" "), props, key)}</p>);
      continue;
    }
    i++;
  }
  return <div className="prose-answer text-sm leading-relaxed">{blocks}</div>;
}
