import "dotenv/config";
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

async function run() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL UNIQUE,
        username VARCHAR(100) NOT NULL UNIQUE,
        fullname VARCHAR(255) NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);
    console.log("Table created successfully");
  } catch (err) {
    console.error("Error creating table", err);
  } finally {
    await pool.end();
  }
}

run();
