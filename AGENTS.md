# Folio (repo `chatdocs`) — guía para agentes

Chat con documentos con citas literales verificadas por página para equipos legales, de cumplimiento e investigación.

## Estructura
- Monorepo **pnpm** (`pnpm-workspace.yaml`): `apps/api` y `apps/web`. Sin Turborepo: `pnpm -r <script>`.
- `apps/api`: **Hono 4** + **Drizzle ORM 0.45** + PostgreSQL 17 con **pgvector**. TypeScript ESM (imports con `.js`).
  - Esquema en `src/db/schema.ts`; migraciones SQL versionadas en `drizzle/` (la inicial se escribió a mano: si cambias el esquema, añade una migración nueva con `pnpm --filter @folio/api db:generate` y revísala).
  - Se aplican con `pnpm db:migrate` (migrador de drizzle-orm), también al arrancar el contenedor.
  - IA detrás de interfaces (`src/ai`): Anthropic (SDK oficial), OpenAI-compatible (REST) o **mock** sin claves.
  - Pagos detrás de `PaymentProvider` (`src/billing/providers`): Stripe, PayPal, Mercado Pago y simulada.
- `apps/web`: **Next.js 16** (App Router) + React 19 + Tailwind 4 + Zustand. `src/proxy.ts` reemplaza a `middleware.ts` (convención de Next 16).

## Reglas
- La API es la única que decide permisos: toda ruta de datos va bajo `/api/workspaces/:workspaceId/...` con `workspaceMember` y, si modifica, `requireRole("editor"|"owner")`. Filtra SIEMPRE por `workspaceId`.
- Sesión = cookie httpOnly opaca (`folio_session`) con hash en `sessions`; nada de tokens en `localStorage`.
- Validación con zod en cada ruta (`validate("json"|"query"|"param", schema)`); PATCH parciales sin `.default()`.
- Logs con pino: nunca query strings, cookies ni tokens.
- Textos de la interfaz y documentación en español.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
