import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit solo se usa en desarrollo (studio / generar migraciones nuevas).
 * Las migraciones versionadas viven en ./drizzle y se aplican con `pnpm db:migrate`
 * (o al arrancar el contenedor), usando el migrador de drizzle-orm.
 */
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://folio:folio@127.0.0.1:5524/folio",
  },
});
