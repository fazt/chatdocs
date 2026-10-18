import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { env } from "../config/env.js";
import * as schema from "./schema.js";

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: env.NODE_ENV === "test" ? 5 : 15,
  idleTimeoutMillis: 30_000,
});

export const db = drizzle(pool, { schema });
export type Db = typeof db;
/** Cliente dentro de una transacción (`db.transaction(async (tx) => …)`). */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export { schema };

/** Vector → literal de pgvector ('[0.1,0.2,…]'). */
export const toVectorLiteral = (vector: number[]): string => `[${vector.map((v) => (Number.isFinite(v) ? v : 0)).join(",")}]`;
