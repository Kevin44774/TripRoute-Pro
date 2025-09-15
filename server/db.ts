// server/db.ts
import "dotenv/config";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";

let db: any;

const url = process.env.DATABASE_URL;

if (!url || url.startsWith("file:")) {
  // ✅ Fallback to local SQLite
  const sqlite = new Database((url || "file:./dev.db").replace("file:", ""));
  db = drizzleSqlite(sqlite);
} else {
  // ✅ Remote LibSQL/Turso
  const client = createClient({
    url,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  db = drizzleLibsql(client);
}

export { db };
