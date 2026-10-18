import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./client.js";

/**
 * Aplica las migraciones versionadas de ./drizzle (idempotente: drizzle guarda
 * las aplicadas en drizzle.__drizzle_migrations). Funciona igual desde src (tsx)
 * que desde dist (node): la carpeta está dos niveles por encima de este archivo.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
export const migrationsFolder = path.resolve(here, "../../drizzle");

export async function runMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder });
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  runMigrations()
    .then(() => {
      console.log(`Migraciones aplicadas (${migrationsFolder})`);
      return pool.end();
    })
    .catch(async (error) => {
      console.error("Error al migrar:", error);
      await pool.end();
      process.exit(1);
    });
}
