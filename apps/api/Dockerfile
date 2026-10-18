# syntax=docker/dockerfile:1.7
# API de Folio (Hono + Drizzle). Se construye desde la raíz del monorepo:
#   docker build -f apps/api/Dockerfile -t folio-api .

FROM node:22-alpine AS base
RUN corepack enable
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
WORKDIR /app

# ---- build: instala todo y compila TypeScript ----
FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api apps/api
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @folio/api...
RUN pnpm --filter @folio/api build

# ---- deps: solo producción (el migrador es drizzle-orm, que ya es dependency) ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter @folio/api...

# ---- runtime ----
FROM base AS runtime
ENV NODE_ENV=production PORT=4095 HOST=0.0.0.0 UPLOAD_DIR=/app/apps/api/uploads
COPY --from=deps --chown=node:node /app /app
COPY --from=build --chown=node:node /app/apps/api/dist /app/apps/api/dist
COPY --chown=node:node apps/api/drizzle /app/apps/api/drizzle
COPY --chown=node:node apps/api/seed-data /app/apps/api/seed-data
COPY --chown=node:node apps/api/docker-entrypoint.sh /app/apps/api/docker-entrypoint.sh
RUN mkdir -p /app/apps/api/uploads && chown node:node /app/apps/api/uploads && chmod +x /app/apps/api/docker-entrypoint.sh
USER node
WORKDIR /app/apps/api
EXPOSE 4095
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/health || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]
