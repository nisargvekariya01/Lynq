import pg from "pg";
import env from "./env.js";

const { Pool } = pg;

if (!env.databaseUrl) {
  console.warn(
    "⚠️ DATABASE_URL is not set. Application may not function correctly.",
  );
}

const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 30, // Increased for load tests (default is 10)
  connectionTimeoutMillis: 30000, // 30s to allow Neon serverless compute to wake up
});

/**
 * Automatically create tables if they do not exist
 */
export const initDb = async () => {
  try {
    console.log("⏳ Connecting to Neon PostgreSQL...");
    await pool.query("SELECT 1");
    console.log("✅ Connected to Neon PostgreSQL");

    const createUrlsTable = `
      CREATE TABLE IF NOT EXISTS urls (
        id SERIAL PRIMARY KEY,
        short_code VARCHAR(30) UNIQUE NOT NULL,
        original_url TEXT NOT NULL,
        title VARCHAR(255),
        tags VARCHAR(255),
        password_hash VARCHAR(255),
        max_clicks INTEGER,
        clicks INTEGER DEFAULT 0,
        edit_token VARCHAR(255),
        device_id VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_visited TIMESTAMP WITH TIME ZONE,
        expires_at TIMESTAMP WITH TIME ZONE
      );
    `;

    const createVisitorsTable = `
      CREATE TABLE IF NOT EXISTS unique_visitors (
        id SERIAL PRIMARY KEY,
        short_code VARCHAR(30) REFERENCES urls(short_code) ON DELETE CASCADE,
        visitor_hash VARCHAR(32) NOT NULL,
        UNIQUE(short_code, visitor_hash)
      );
    `;

    const createHistoryTable = `
      CREATE TABLE IF NOT EXISTS click_history (
        id SERIAL PRIMARY KEY,
        short_code VARCHAR(30) REFERENCES urls(short_code) ON DELETE CASCADE,
        clicked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        visitor_hash VARCHAR(32),
        user_agent TEXT
      );
    `;

    await pool.query(createUrlsTable);
    await pool.query(createVisitorsTable);
    await pool.query(createHistoryTable);

    // Ensure edit_token, title, tags exist for existing databases
    try {
      await pool.query("ALTER TABLE urls ADD COLUMN edit_token VARCHAR(255);");
    } catch (e) {
      // Column likely already exists, ignore
    }
    try {
      await pool.query("ALTER TABLE urls ADD COLUMN title VARCHAR(255);");
    } catch (e) {
      // Column likely already exists, ignore
    }
    try {
      await pool.query("ALTER TABLE urls ADD COLUMN tags VARCHAR(255);");
    } catch (e) {
      // Column likely already exists, ignore
    }
    try {
      await pool.query("ALTER TABLE urls ADD COLUMN device_id VARCHAR(255);");
    } catch (e) {
      // Column likely already exists, ignore
    }
    try {
      await pool.query(
        "ALTER TABLE unique_visitors ADD CONSTRAINT unique_visitor_hash UNIQUE (short_code, visitor_hash);",
      );
    } catch (e) {
      // Constraint likely already exists, ignore
    }

    // ── Phase 1: Composite Performance Indexes ────────────────────────────────
    // All use IF NOT EXISTS so they are safe to re-run on every cold-start.
    // These run on the pool (not a dedicated client) so Neon won't block other
    // queries while indexes are being created on an empty / small table.

    // Index 1: Speeds up all analytics timeline queries filtered by short_code
    //          and ordered by clicked_at DESC (used in getUrlInfo history query).
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_click_history_code_time
        ON click_history (short_code, clicked_at DESC);
    `);

    // Index 2: Speeds up the duplicate-URL-per-device lookup in shortenUrl()
    //          and bulkShortenUrls() — avoids full sequential scan on urls.
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_urls_original_device
        ON urls (original_url, device_id);
    `);

    // Index 3: Partial index — only indexes rows that actually have an expiry.
    //          Accelerates expiry-check queries and future cleanup jobs.
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_urls_expires_at
        ON urls (expires_at) WHERE expires_at IS NOT NULL;
    `);

    console.log("✅ PostgreSQL Schema & Indexes Verified");
  } catch (err) {
    console.error("❌ Failed to initialize PostgreSQL:", err);
    process.exit(1);
  }
};

export default pool;
