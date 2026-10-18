#!/bin/sh
set -e

# Aplica las migraciones versionadas (drizzle/) antes de arrancar.
node dist/db/migrate.js

# Seed opcional e IDEMPOTENTE (admin + demo si SEED_DEMO=true). No borra datos.
if [ "$SEED_ON_START" = "true" ]; then
  echo "SEED_ON_START=true: sembrando administrador y datos de demo..."
  node dist/db/seed.js
fi

# exec: node pasa a ser PID 1 y recibe SIGTERM para el apagado ordenado.
exec node dist/index.js
