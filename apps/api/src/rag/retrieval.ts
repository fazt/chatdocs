import { sql } from "drizzle-orm";
import { embeddings } from "../ai/index.js";
import { env } from "../config/env.js";
import { db, toVectorLiteral } from "../db/client.js";

export interface RetrievedChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  documentKind: "pdf" | "docx" | "markdown" | "text";
  page: number;
  heading: string | null;
  content: string;
  score: number;
}

/** Constante k de Reciprocal Rank Fusion (valor estándar). */
const RRF_K = 60;

/**
 * Búsqueda HÍBRIDA: vectorial (pgvector, coseno) + léxica (tsvector de
 * Postgres) fusionadas con RRF. La léxica importa mucho en textos legales y
 * académicos: "artículo 14.2", "cláusula décima", un DOI o una sigla exacta no
 * siempre quedan cerca en el espacio semántico.
 *
 * Siempre filtra por espacio de trabajo Y por la lista de documentos permitidos
 * (la consulta nunca ve fragmentos de otro equipo).
 */
export async function hybridSearch(options: {
  workspaceId: string;
  documentIds: string[];
  query: string;
  limit?: number;
  queryVector?: number[];
}): Promise<RetrievedChunk[]> {
  const { workspaceId, documentIds, query } = options;
  if (documentIds.length === 0 || !query.trim()) return [];
  const limit = options.limit ?? env.RAG_TOP_K;
  const candidates = Math.max(env.RAG_CANDIDATES, limit * 3);
  const vector = options.queryVector ?? (await embeddings.embed([query]))[0]!;
  const docs = sql`ARRAY[${sql.join(documentIds.map((id) => sql`${id}`), sql`, `)}]::uuid[]`;

  const result = await db.execute<{
    id: string;
    document_id: string;
    document_title: string;
    document_kind: RetrievedChunk["documentKind"];
    page: number;
    heading: string | null;
    content: string;
    score: number;
  }>(sql`
    WITH vec AS (
      SELECT c.id, row_number() OVER (ORDER BY c.embedding <=> ${toVectorLiteral(vector)}::vector) AS rank
      FROM chunks c
      WHERE c.workspace_id = ${workspaceId} AND c.document_id = ANY(${docs})
      ORDER BY c.embedding <=> ${toVectorLiteral(vector)}::vector
      LIMIT ${candidates}
    ),
    q AS (SELECT websearch_to_tsquery('simple', ${query}) AS query),
    lex AS (
      SELECT c.id, row_number() OVER (ORDER BY ts_rank_cd(c.tsv, q.query) DESC) AS rank
      FROM chunks c, q
      WHERE c.workspace_id = ${workspaceId} AND c.document_id = ANY(${docs}) AND c.tsv @@ q.query
      ORDER BY ts_rank_cd(c.tsv, q.query) DESC
      LIMIT ${candidates}
    ),
    fused AS (
      SELECT id, SUM(1.0 / (${RRF_K} + rank)) AS score
      FROM (SELECT id, rank FROM vec UNION ALL SELECT id, rank FROM lex) ranked
      GROUP BY id
    )
    SELECT c.id, c.document_id, d.title AS document_title, d.kind AS document_kind, c.page, c.heading, c.content,
           f.score::float8 AS score
    FROM fused f
    JOIN chunks c ON c.id = f.id
    JOIN documents d ON d.id = c.document_id
    WHERE d.status = 'ready'
    ORDER BY f.score DESC, c.document_id, c.chunk_index
    LIMIT ${limit}
  `);

  return result.rows.map((row) => ({
    id: row.id,
    documentId: row.document_id,
    documentTitle: row.document_title,
    documentKind: row.document_kind,
    page: row.page,
    heading: row.heading,
    content: row.content,
    score: Number(row.score),
  }));
}

/**
 * Para COMPARAR documentos: los mejores fragmentos de CADA documento por
 * separado, así ninguno queda fuera porque otro acapare el top-k.
 */
export async function searchPerDocument(options: {
  workspaceId: string;
  documentIds: string[];
  query: string;
  perDocument?: number;
}): Promise<RetrievedChunk[]> {
  const queryVector = (await embeddings.embed([options.query]))[0]!;
  const results = await Promise.all(
    options.documentIds.map((documentId) =>
      hybridSearch({
        workspaceId: options.workspaceId,
        documentIds: [documentId],
        query: options.query,
        limit: options.perDocument ?? 3,
        queryVector,
      }),
    ),
  );
  return results.flat();
}
