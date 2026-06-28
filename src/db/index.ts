import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const globalForDb = globalThis as typeof globalThis & {
  __forgeLoadPool?: Pool;
};

export const pool =
  globalForDb.__forgeLoadPool ??
  new Pool({
    connectionString: databaseUrl,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__forgeLoadPool = pool;
}

export const db = drizzle(pool, { schema });
export * from "./schema";
