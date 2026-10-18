# Folio — chat con documentos y citas verificables por página

**Folio** es una aplicación para que **equipos legales, áreas de cumplimiento normativo e investigadores** pregunten a sus contratos, políticas, normas y papers en lenguaje natural. Cada respuesta trae la **cita literal y su página**, Folio **verifica** que esa frase exista de verdad en el documento y te lleva al texto resaltado en un clic. Además **compara documentos**, **extrae cláusulas o campos** a una tabla con su cita y **exporta** las respuestas con sus fuentes.

> Repo `fazt/chatdocs`. Antes era un prototipo genérico «ChatDocs» (Markdown + imágenes); se reescribió como Folio.

## Capturas — pendientes (se generan en la fase de comprobación)

Este repo se reescribió en **modo solo escritura** (sin ejecutar nada). Las capturas reales de la landing, el chat con citas, el visor de documentos, la tabla de extracción, el equipo y el panel de administración se tomarán al levantar el proyecto (ver [`docs/VERIFICACION.md`](docs/VERIFICACION.md)) y se guardarán en `docs/screenshots/`.

## En qué se diferencia de sus hermanos

| Proyecto | Para qué es |
| --- | --- |
| **Folio** (este) | Trabajo profesional con documentos largos: **citas literales verificadas por página**, comparación entre documentos, extracción de cláusulas a CSV, exportación con fuentes, equipos con roles y bitácora de auditoría. |
| ai-rag-chat | Chat RAG general con IA sobre tus documentos. |
| RAG Chat Local (`rag-chat`) | RAG que corre en tu red, con modelos locales. |
| Atiendo (`chatbot-rag`) | Chatbot de **soporte al cliente** embebible en una web (widget, handoff a humano). |
| mychat-rag | Chat RAG personal. |

## Características

- **Ingesta por página**: PDF (página real), DOCX, Markdown y TXT (por sección). Detección del tipo por contenido, deduplicación por hash, límite de páginas por documento, cola en segundo plano con reintento al reiniciar.
- **Búsqueda híbrida**: pgvector (coseno, índice HNSW) + texto completo de PostgreSQL (`tsvector`, índice GIN) fusionados con **RRF**. Encuentra conceptos («qué pasa si no pago») y términos exactos («artículo 1430», un DOI).
- **Chat con citas verificadas**: respuestas en streaming (SSE) con referencias `[n]`; las citas «literales» se comprueban contra el texto de la página (tolerante a tildes, mayúsculas, saltos de línea y omisiones `…`) y se marcan ✔/✘.
- **Visor del documento** en la página citada con la frase resaltada, ficha editable (partes, fecha de firma, norma, autores, año, DOI, notas) y descarga del original.
- **Comparación** de 2 a 6 documentos: búsqueda por documento y tabla comparativa con referencias.
- **Extracciones**: plantillas *Contrato: cláusulas clave*, *Política: cumplimiento* y *Artículo académico: ficha de lectura* (o campos propios); tabla documento × campo con valor, cita, página y verificación; **exportación CSV** (con BOM y protección contra inyección de fórmulas).
- **Exportación** de conversaciones a Markdown o HTML imprimible (PDF) con fuentes y estado de cada cita.
- **Equipos**: espacios de trabajo con roles (propietario, editor, lector), expedientes por caso/cliente/proyecto, invitaciones por email (token de un uso, caduca en 7 días), **bitácora de auditoría** (subidas, descargas, exportaciones, cambios de rol…).
- **Planes** Gratis / Pro (USD 19) / Equipo (USD 59) por 30 días con límites mensuales atómicos (preguntas, páginas, extracciones, documentos, personas) y pagos con **Stripe, PayPal, Mercado Pago** o pasarela **simulada** (solo demo), webhooks firmados e idempotentes, reembolsos desde el panel.
- **Administración**: métricas (usuarios, espacios pagados, páginas, uso del mes, ingresos por moneda), usuarios (rol, desactivar con corte inmediato de sesión), espacios y pagos.
- **Modo demo sin claves**: embeddings por hashing y respuestas extractivas que citan frases literales, para probar todo sin coste.
- Landing en español, precios, modo claro/oscuro, responsive, accesible (skip link, foco visible, ARIA), SEO (metadata, Open Graph, JSON-LD, sitemap, robots), 404 y página de error.

## Stack

| Capa | Tecnología |
| --- | --- |
| API | Node 22 · **Hono 4** · zod 4 · **Drizzle ORM 0.45** · pino · bcrypt |
| Base de datos | **PostgreSQL 17 + pgvector** (HNSW) + búsqueda de texto completo |
| IA | **Claude** (`@anthropic-ai/sdk`, por defecto `claude-opus-5-5`), OpenAI o compatible (Ollama, vLLM) · embeddings `text-embedding-3-small` (1536) · mock sin claves |
| Documentos | `unpdf` (texto por página), `mammoth` (DOCX) |
| Web | **Next.js 16** (App Router, `proxy.ts`) · React 19 · Tailwind CSS 4 · Zustand · lucide · sonner |
| Pagos | Stripe Checkout, PayPal Orders v2, Mercado Pago Checkout Pro (REST, sandbox) + simulada |
| Producción | Dockerfiles multi-etapa, `docker-compose.prod.yml` con nginx (SSE sin búfer, logs sin query strings) |

## Puesta en marcha (desarrollo)

Requisitos: Node 22+, pnpm 10, Docker.

```bash
pnpm install
docker compose up -d                       # PostgreSQL + pgvector en 127.0.0.1:5524 (crea también folio_test)
cp apps/api/.env.example apps/api/.env     # sin claves = modo demo
cp apps/web/.env.example apps/web/.env.local
pnpm db:migrate                            # aplica apps/api/drizzle/*.sql
pnpm db:seed                               # admin + demo (idempotente)
pnpm dev                                   # API http://127.0.0.1:4095 · web http://127.0.0.1:5264
```

La web reenvía `/api/*` a la API (rewrites de Next), así la cookie de sesión es del mismo origen.

### Credenciales de demo (tras `pnpm db:seed`)

| Rol | Email | Contraseña |
| --- | --- | --- |
| Administración | `admin@folio.local` | `Admin12345!` |
| Propietaria del estudio (plan Equipo) | `lucia@estudioquispe.pe` | `Demo12345!` |
| Editor | `andres@estudioquispe.pe` | `Demo12345!` |
| Lectora | `paula@estudioquispe.pe` | `Demo12345!` |
| Investigadora (plan Gratis) | `rosa@pucp-demo.pe` | `Demo12345!` |

La demo incluye el **Estudio Quispe & Asociados** con dos expedientes (contratos de arrendamiento y de soporte TI, y una política de protección de datos), conversaciones con citas verificadas, una comparación, una extracción de cláusulas y un pago; y un espacio de **tesis** con un paper sobre teletrabajo.

### Scripts

| Comando | Qué hace |
| --- | --- |
| `pnpm dev` | API (tsx watch) y web (Next) en paralelo |
| `pnpm build` · `pnpm typecheck` · `pnpm lint` | En todos los paquetes |
| `pnpm test` | API: Vitest (unitarios + integración contra `folio_test`) · web: Vitest |
| `pnpm db:migrate` · `pnpm db:seed` | Migraciones y datos de demo |

## Variables de entorno

- `apps/api/.env.example`: base de datos, `APP_SECRET`, URLs públicas, IA (`LLM_PROVIDER`, `ANTHROPIC_*`, `OPENAI_*`, `EMBEDDING_*`), RAG, almacenamiento (`STORAGE_DRIVER=local|s3`, originales **privados**), email (Resend), pagos y seed. Se validan al arrancar.
- `apps/web/.env.example`: `NEXT_PUBLIC_SITE_URL` y `API_INTERNAL_URL`.
- `.env.prod.example`: todo lo del compose de producción.

## Producción

```bash
cp .env.prod.example .env.prod   # cambia los secretos
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
# http://localhost:8164
```

- La API aplica las migraciones al arrancar y, con `SEED_ON_START=true`, crea el administrador (idempotente).
- nginx sirve todo en un solo origen, `/api` sin búfer (SSE) y registra rutas **sin query string**.
- La pasarela simulada queda **apagada** por defecto (`PAYMENTS_SIMULATED_ENABLED=false`).
- Webhooks: `POST /api/billing/webhooks/{stripe|paypal|mercadopago}` (firma verificada sobre el cuerpo crudo, idempotentes); retorno de PayPal en `GET /api/billing/paypal/return`.
- Healthcheck: `GET /api/health` (comprueba la base).

## Seguridad (resumen)

Sesiones opacas en base de datos (revocables; el rol se lee en cada petición), cookies httpOnly + SameSite, chequeo anti-CSRF por `Origin`, rate limits (login cuenta solo fallidos; registro, olvidé contraseña, invitaciones y checkout cuentan todo), recuperación sin enumeración con token de un uso en el `#fragmento`, aislamiento estricto por espacio (otro espacio responde 404), originales privados descargables solo con sesión, prompts que tratan el contenido de los documentos como datos, CSP y cabeceras de seguridad.

## Estructura

```
apps/
  api/
    drizzle/              migraciones SQL versionadas
    seed-data/            documentos de la demo
    src/
      ai/                 proveedores de IA (Anthropic, OpenAI-compatible, mock)
      billing/            PaymentProvider + Stripe, PayPal, Mercado Pago, simulada
      config/             env (zod) y planes
      db/                 esquema Drizzle, cliente, migrador y seed
      lib/                logger, errores, sesiones, rate limit, uso, auditoría, email, storage
      middleware/         auth, espacio de trabajo, anti-CSRF, validación
      rag/                extracción por página, chunker, búsqueda híbrida, prompts, citas, extracciones, exportación
      routes/             auth, espacios, documentos, conversaciones, extracciones, pagos, admin
    test/                 Vitest (unitarios e integración)
  web/
    src/app/              landing, precios, auth, /app (consultas, chat, documentos, visor, extracciones, equipo, actividad, plan, cuenta, admin)
    src/components/       landing, panel, markdown seguro, UI
deploy/                   nginx y base de test
docs/VERIFICACION.md      checklist de comprobación
```

## Estado

Código escrito sin ejecutar (modo solo escritura): falta instalar dependencias, compilar, correr tests y recorrer la app. Todo lo pendiente está en [`docs/VERIFICACION.md`](docs/VERIFICACION.md).
