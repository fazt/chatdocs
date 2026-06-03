# Plan: Express + TypeScript API independiente

Extraer todas las rutas API de Next.js (`src/app/api/`) a una API Express autónoma en `api/`.

## Estructura de archivos a crear

```
api/
├── package.json
├── tsconfig.json
├── .env
├── nodemon.json
└── src/
    ├── index.ts                       # Express app bootstrap
    ├── config.ts                      # Env vars centralizadas
    ├── middleware/
    │   └── auth.middleware.ts         # requireAuth + optionalAuth
    ├── routes/
    │   ├── index.ts                   # Agregador de rutas
    │   ├── auth.routes.ts             # POST register/login/logout, GET me
    │   ├── documents.routes.ts        # GET /, POST / (multer), DELETE /:id
    │   ├── conversations.routes.ts    # GET /, POST /, GET /:id, DELETE /:id
    │   └── chat.routes.ts             # POST /:conversationId (SSE)
    ├── lib/
    │   ├── auth.ts                    # MODIFICADO: sin next/headers, cookie helpers con res
    │   ├── chat.ts                    # COPIADO: buildSystemPrompt, streamChatCompletion, buildSources
    │   ├── chunker.ts                 # COPIADO: chunkMarkdown
    │   ├── constants.ts               # COPIADO
    │   ├── embeddings.ts              # COPIADO
    │   ├── openai.ts                  # COPIADO
    │   ├── utils.ts                   # COPIADO (solo uuid, now)
    │   └── vector.ts                  # COPIADO
    ├── db/
    │   ├── index.ts                   # COPIADO: conexión better-sqlite3 + drizzle
    │   └── schema.ts                  # COPIADO: 6 tablas
    └── types/
        └── index.ts                   # COPIADO: interfaces
```

## 22 archivos a crear

### 1. `api/package.json`
```json
{
  "name": "chatdocs-api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "bcryptjs": "^3.0.3",
    "better-sqlite3": "^12.10.0",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.5",
    "drizzle-orm": "^0.45.2",
    "express": "^4.21.0",
    "jsonwebtoken": "^9.0.3",
    "multer": "^1.4.5-lts.2",
    "openai": "^6.41.0"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/better-sqlite3": "^7.6.13",
    "@types/cookie-parser": "^1.4.7",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.10",
    "@types/multer": "^1.4.12",
    "@types/node": "^20",
    "tsx": "^4.19.0",
    "typescript": "^5"
  }
}
```

### 2. `api/tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 3. `api/.env`
```
DATABASE_URL=../data/chatdocs.db
CORS_ORIGIN=http://localhost:3000
PORT=3001
OPENAI_API_KEY=sk-your-key
OPENAI_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
JWT_SECRET=chatdocs-jwt-secret-2026-change-in-production
```

### 4. `api/nodemon.json`
```json
{
  "watch": ["src"],
  "ext": "ts",
  "exec": "tsx src/index.ts"
}
```

### 5. `api/src/index.ts`
- Express app con `cors()`, `express.json()`, `cookie-parser()`
- Monta rutas en `/api`
- Manejo global de errores
- Puerto de `config.ts` (default 3001)

### 6. `api/src/config.ts`
- Centraliza `process.env` con defaults
- Exporta `config` objeto tipado

### 7. `api/src/middleware/auth.middleware.ts`
- `requireAuth`: lee `req.cookies.chatdocs_token`, verifica JWT, asigna `req.user`, 401 si no
- `optionalAuth`: igual pero no error si no hay token
- Extiende `Express.Request` global con `user?: { userId, email }`

### 8-11. Route files (`auth.routes.ts`, `documents.routes.ts`, `conversations.routes.ts`, `chat.routes.ts`)
Traducción directa de la lógica existente:

| Cambio | Next.js | Express |
|--------|---------|---------|
| Request body | `await req.json()` | `req.body` (express.json) |
| Response | `NextResponse.json(data, { status })` | `res.status(code).json(data)` |
| Auth | `await getAuthUser()` | `req.user` (middleware) |
| Params | `params: Promise<{ id }>` | `req.params.id` |
| File upload | `await req.formData()` | `req.file` (multer) |
| SSE | `new ReadableStream(...)` + `new Response(stream)` | `res.write()` + `res.end()` |
| Cookies | `await cookies().set(...)` | `res.cookie(...)` |

### 12-21. Copias directas de `src/`:
- `api/src/lib/chat.ts`
- `api/src/lib/chunker.ts`
- `api/src/lib/constants.ts`
- `api/src/lib/embeddings.ts`
- `api/src/lib/openai.ts`
- `api/src/lib/vector.ts`
- `api/src/lib/utils.ts` (solo `uuid()` y `now()`)
- `api/src/db/index.ts`
- `api/src/db/schema.ts`
- `api/src/types/index.ts`

### 22. `api/src/lib/auth.ts` (MODIFICADO)
- Mantener: `hashPassword`, `verifyPassword`, `signToken`, `verifyToken` (sin cambios)
- Eliminar: import `next/headers`, función `getAuthUser`
- Cambiar: `setAuthCookie(token)` → `setAuthCookie(res, token)` (sincrónico, usa `res.cookie()`)
- Cambiar: `removeAuthCookie()` → `removeAuthCookie(res)` (usa `res.clearCookie()`)

## Dependencias nuevas vs existentes

| Paquete | Ya en package.json raíz | Nueva |
|---------|------------------------|-------|
| express | ❌ | ✅ |
| cors | ❌ | ✅ |
| cookie-parser | ❌ | ✅ |
| multer | ❌ | ✅ |
| bcryptjs | ✅ | ❌ (misma versión) |
| better-sqlite3 | ✅ | ❌ (misma versión) |
| drizzle-orm | ✅ | ❌ (misma versión) |
| jsonwebtoken | ✅ | ❌ (misma versión) |
| openai | ✅ | ❌ (misma versión) |
| tsx | ❌ | ✅ (dev) |
| typescript | ✅ | ❌ (misma versión) |
| @types/* | ❌ | ✅ 6 tipos |

## Cómo ejecutar

```bash
# Terminal 1: Next.js frontend
npm run dev          # http://localhost:3000

# Terminal 2: Express API
cd api && npm install && npm run dev   # http://localhost:3001
```

## Orden de implementación

1. Crear estructura de directorios en `api/`
2. `api/package.json`, `api/tsconfig.json`, `api/.env`, `api/nodemon.json`
3. Copiar archivos compartidos (lib/, db/, types/)
4. `api/src/lib/auth.ts` modificado
5. `api/src/config.ts`, `api/src/middleware/auth.middleware.ts`
6. `api/src/routes/*.ts` (todos los handlers)
7. `api/src/index.ts` (entry point)
8. `npm install` en `api/` y verificar que compila

## Verificación

```bash
cd api && npx tsx src/index.ts
# Debería ver: "API server running on http://localhost:3001"

# Test endpoints (usando curl o httpie):
curl http://localhost:3001/api/auth/me
# → {"user":null}

curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"123456"}'
# → 201 con user object + cookie
```
