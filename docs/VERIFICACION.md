# Verificación pendiente — Folio (repo chatdocs)

Este repo se reescribió en **modo solo escritura** (2026-10-18): no se instaló, compiló, ejecutó ni probó nada. Esta es la lista concreta para comprobarlo.

## 1. Instalación y compilación

- [ ] `pnpm install` en la raíz. **El `pnpm-lock.yaml` está desactualizado** (es el del Next suelto original: no incluye `apps/api` ni las dependencias nuevas). Regenerarlo y commitearlo: los Dockerfiles usan `--frozen-lockfile`.
- [ ] `pnpm typecheck` (api y web) y `pnpm lint`.
- [ ] `pnpm build` (api → `apps/api/dist/index.js`; web → `.next/standalone`).
- Riesgos de tipos anotados:
  - `apps/api/src/ai/llm.ts`: parámetros `thinking: {type:"adaptive"}`, `output_config.effort`, `fallbacks: "default"` + `betas` en `client.beta.messages.stream` (SDK `@anthropic-ai/sdk` ^0.135). Si el SDK no tipa `fallbacks`, castear el objeto de parámetros o quitarlo (`ANTHROPIC_FALLBACKS=false`).
  - `drizzle-orm` 0.45: `vector(...)`, `customType` con `.generatedAlwaysAs`, `index().using("hnsw", t.embedding.op("vector_cosine_ops"))`.
  - `@hono/zod-validator` 0.8 con zod 4 (`validate()` en `src/middleware/validate.ts` lanza `HttpError` desde el hook).
  - `hono/body-limit` `onError` que lanza; `c.body(Uint8Array)`.
  - `z.iso.datetime()`, `z.uuid()`, `z.email()` (API de zod 4).
  - Next 16: `src/proxy.ts` (export `proxy`), páginas cliente con `useParams`/`useSearchParams` envueltas en `Suspense`.
  - Versiones con caret nuevas (vitest ^4, @types/node ^24, pino ^10, unpdf ^1.9, mammoth ^1.13): confirmar que existen y compilan.

## 2. Base de datos y migraciones

- [ ] `docker compose up -d` → `folio-db` en `127.0.0.1:5524` (crea `folio` y `folio_test`).
- [ ] `pnpm db:migrate`: aplica `apps/api/drizzle/0000_init.sql` (escrita a mano; `meta/_journal.json` también). Revisar que crea la extensión `vector`, los enums, la columna generada `tsv` y los índices HNSW/GIN.
- [ ] Coherencia esquema ↔ migración: `pnpm --filter @folio/api exec drizzle-kit generate` **no debería** producir cambios relevantes. Ojo: no hay snapshot en `drizzle/meta/` (no se pudo generar sin ejecutar), así que la primera vez drizzle-kit intentará generar TODO; en ese caso, generar el snapshot (`drizzle-kit generate` contra una base vacía en una rama, comparar el SQL con `0000_init.sql` y quedarse solo con el snapshot).
- [ ] `pnpm db:seed` dos veces: la segunda no debe duplicar nada. La demo indexa 4 documentos Markdown y genera 4 conversaciones con el proveedor activo (mock si no hay claves) y deja una extracción en cola que corre al arrancar la API.

## 3. Tests

- [ ] `pnpm --filter @folio/api test` (usa `folio_test`; el global-setup BORRA y recrea el esquema `public` de esa base). Cubre: texto/citas/chunker/extracción, Stripe firmado, rate limiter, mock, y de integración: health, 404 en rutas desconocidas, CSRF por Origin, registro/logout, olvidé contraseña, usuario desactivado, indexado por secciones, duplicados, chat SSE con citas verificadas + exportación, aislamiento entre espacios (incluido mover a un expediente ajeno), lector sin permisos de escritura, PATCH parcial de metadatos, extracción + CSV, **cupo mensual atómico con 130 peticiones simultáneas** y webhook simulado idempotente con dos envíos concurrentes.
- [ ] `pnpm --filter @folio/web test` (parser SSE, `safeNext`, formato).

## 4. Recorrido en navegador (dev: http://127.0.0.1:5264)

- [ ] Landing (claro/oscuro, móvil 375 px: menú, marquee, secciones), `/precios`, 404.
- [ ] Registro → espacio personal con expediente «Mis documentos». Login, logout, recuperar contraseña (el enlace aparece en el log de la API con `MAIL_DRIVER=console`) y restablecer (token en `#fragmento`).
- [ ] Documentos: crear/editar/borrar expediente, subir varios archivos (PDF real con texto, DOCX, MD, TXT), ver estados En cola → Indexando → Listo, error con PDF escaneado, duplicado (409), búsqueda y paginación.
- [ ] Visor: navegación por páginas, `?pagina=&cita=` resalta la frase, editar ficha, descargar original.
- [ ] Consultas: nueva consulta (todo el expediente / documentos elegidos), streaming, detener, citas `[n]` clicables, panel de fuente (lateral en escritorio, hoja inferior en móvil), insignia «x/y citas verificadas», exportar MD y HTML (abrir el HTML e imprimir a PDF).
- [ ] Comparar 2–3 documentos: tabla comparativa.
- [ ] Extracciones: plantilla de contrato sobre los 2 contratos de la demo, tabla con citas, CSV en Excel (tildes correctas).
- [ ] Equipo: invitar (el email sale en el log), aceptar con otra cuenta del MISMO email (y comprobar que con otro email se rechaza), cambiar rol, no poder quitar al último propietario, salir del espacio. Lector: no ve botones de subir/borrar.
- [ ] Actividad: aparecen subidas, descargas, exportaciones.
- [ ] Plan: pago simulado (`PAYMENTS_SIMULATED_ENABLED=true` en dev) → plan Pro con 30 días; pago rechazado; límites (bajar `PLANS.free` temporalmente para ver el 402).
- [ ] Admin (`admin@folio.local`): métricas, desactivar usuario (su sesión se corta al instante), hacer admin, reembolsar pago simulado.
- [ ] **SSE a través del rewrite de Next en dev**: si las respuestas llegan de golpe (búfer/compresión del proxy de Next), probar directo contra la API o desactivar compresión; en producción nginx tiene `proxy_buffering off`.

## 5. Con claves reales (opcional)

- [ ] `ANTHROPIC_API_KEY` → respuestas de `claude-opus-5-5` con citas «…» [n]; comprobar el porcentaje de citas verificadas y el manejo de `stop_reason: "refusal"`.
- [ ] `OPENAI_API_KEY` → embeddings `text-embedding-3-small` (1536). Cambiar de proveedor de embeddings exige **reindexar** todos los documentos (los vectores no son comparables).
- [ ] Stripe/PayPal/Mercado Pago en sandbox con sus webhooks (`/api/billing/webhooks/<proveedor>`); Mercado Pago cobra en `MERCADOPAGO_CURRENCY` con `MERCADOPAGO_FX_RATE`.
- [ ] Resend para emails reales; S3/Spaces/MinIO con `STORAGE_DRIVER=s3` (bucket privado).

## 6. Producción local

- [ ] `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build` → http://localhost:8164 (comprobar con `netstat` que el 8164 está libre; si no, `WEB_PORT`).
- [ ] `docker compose -f docker-compose.prod.yml exec proxy nginx -t`.
- [ ] Las cabeceras de seguridad salen también en `/api/*` (cada location incluye el snippet).
- [ ] Logs de nginx y de la API sin query strings.
- [ ] `docker compose ... down -v` y `docker image prune -f` al terminar.

## 7. Capturas

- [ ] Guardar en `docs/screenshots/` (landing claro y oscuro, chat con panel de fuente, visor con cita resaltada, extracción, comparación, equipo, admin, móvil) y reemplazar la sección «Capturas — pendientes» del README.

## Riesgos y decisiones conocidas

- Rate limit en memoria (una sola instancia de la API). Con réplicas: moverlo a Redis/Postgres.
- La cola de indexación y de extracciones es en proceso (sin Redis); se reanuda al reiniciar.
- Reindexar un documento vuelve a contar sus páginas en el cupo mensual.
- Borrar una cuenta elimina los espacios donde era la única propietaria, pero **no** borra sus archivos del almacenamiento (limpieza pendiente).
- `POST /auth/register` responde 409 si el email ya existe (enumeración mitigada con rate limit de 5/hora por IP).
- Los PDF escaneados sin capa de texto se rechazan (no hay OCR).
- Se eliminaron del original: subida de imágenes con descripción por visión, SQLite, el checkout de Stripe en Next con email fijo `user@example.com`, y el almacenamiento S3 con `ACL: public-read`.
