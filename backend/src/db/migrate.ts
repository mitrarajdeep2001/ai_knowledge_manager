import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import pg from "pg";
import dns from "dns";
dns.setDefaultResultOrder("ipv4first");
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 1
});

const db = drizzle(pool);

async function main() {
  console.log("Ensuring pgvector extension...");
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`);

  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations completed successfully.");
  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
