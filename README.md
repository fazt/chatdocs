# chatdocs

> **Prototipo** — Aplicación full-stack para chatear con tus documentos mediante RAG. Frontend en Next.js 16 y un backend independiente en Express + PostgreSQL.

## ¿Qué hace?

Subes documentos (Markdown e imágenes), el sistema los divide en fragmentos y genera embeddings con OpenAI. Luego puedes chatear con ellos: la pregunta se vectoriza, se recuperan los fragmentos más relevantes por similitud coseno y el modelo responde citando las fuentes. Incluye autenticación, conversaciones persistentes y facturación con Stripe.

## Características

- 🔐 Autenticación con JWT + bcrypt (registro / login, cookies HTTP-only).
- 📤 Subida drag-and-drop de documentos Markdown e imágenes (almacenados en S3 / DigitalOcean Spaces vía multer).
- ✂️ Chunking automático con solapamiento configurable.
- 🧠 Embeddings con OpenAI y búsqueda semántica por similitud coseno (top-K).
- 💬 Chat RAG con respuestas en streaming y citas de fuentes (documento + encabezado).
- 🗂️ Historial de conversaciones con título autogenerado y contexto multi-documento.
- 💳 Facturación por suscripción con **Stripe** (planes Pro / Enterprise).
- 📧 Emails (Resend) y rutas de administración.

## Stack

**Frontend (`src/` — Next.js)**
- Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4.
- Estado con **Zustand** (auth, chat, documents) · Lucide · Sonner · Stripe.js.

**Backend (`api/` — Express)**
- Express 4 + Node.js (TypeScript; `tsx` en dev, compilado a `dist/`).
- **PostgreSQL** (`pg`) vía **Drizzle ORM** (migraciones con drizzle-kit).
- OpenAI (chat + embeddings) · JWT + bcryptjs · subida con multer → S3 (`@aws-sdk/client-s3`) · Resend · CORS · cookie-parser · Zod.
- Tests con Jest + Supertest (`tests/unit`, `tests/e2e`).

## Cómo ejecutarlo

**Frontend**
```bash
npm install
npm run dev            # http://localhost:3000
npm run build && npm start
npm run db:push        # migraciones Drizzle (drizzle-kit)
```

**Backend (`api/`)**
```bash
cd api
pnpm install           # (el backend usa pnpm)
pnpm dev               # http://localhost:3001 (tsx watch)
pnpm build && pnpm start
pnpm db:push           # migraciones a PostgreSQL
pnpm test              # Jest + Supertest
```

> El backend incluye `docker-compose.yml` para levantar PostgreSQL localmente.

### Variables de entorno

- **Frontend:** `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`, `OPENAI_EMBEDDING_MODEL`, `JWT_SECRET`, `DATABASE_URL`, `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID`, `NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID`.
- **Backend (`api/.env`):** `DATABASE_URL`, `CORS_ORIGIN`, `PORT`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_EMBEDDING_MODEL`, `JWT_SECRET`, `APP_URL`, `RESEND_API_KEY`, `RESEND_FROM`, `SPACES_*` (endpoint, region, bucket, keys, public URL).

Ver `.env.local.example`.

## Arquitectura

- **Split frontend/backend:** el frontend (Next.js) maneja la UI y el checkout de Stripe; el backend (`api/`, puerto 3001, CORS) concentra la lógica de negocio: auth, documentos, chat y conversaciones.
- **Pipeline de documentos:** subida → almacenamiento en S3/Spaces → chunking → embeddings OpenAI → consulta por similitud coseno (top-K) → contexto + pregunta al modelo en streaming.
- **Esquema Drizzle (PostgreSQL):** `users`, `documents`, `chunks` (con embedding y encabezado), `conversations`, `messages` (con fuentes) y la tabla puente `conversation_documents` para contexto multi-documento.

---

🧪 Proyecto en estado de **prototipo**.
