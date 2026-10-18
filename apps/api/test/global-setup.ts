import { rmSync } from "node:fs";
import { testEnv } from "../vitest.config.js";

/** Antes de la suite: base de test limpia y con las migraciones aplicadas. */
export default async function setup(): Promise<() => Promise<void>> {
  Object.assign(process.env, testEnv);
  const { pool } = await import("../src/db/client.js");
  // Empieza siempre desde cero (solo la base folio_test).
  await pool.query("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
  const { runMigrations } = await import("../src/db/migrate.js");
  await runMigrations();
  await pool.end();
  return async () => {
    rmSync("./.test-uploads", { recursive: true, force: true });
  };
}
