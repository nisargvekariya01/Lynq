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

    const schemaSql = `
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
        user_id VARCHAR(255),
        routing_rules JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_visited TIMESTAMP WITH TIME ZONE,
        expires_at TIMESTAMP WITH TIME ZONE
      );

      CREATE TABLE IF NOT EXISTS unique_visitors (
        id SERIAL PRIMARY KEY,
        short_code VARCHAR(30) REFERENCES urls(short_code) ON DELETE CASCADE,
        visitor_hash VARCHAR(32) NOT NULL,
        UNIQUE(short_code, visitor_hash)
      );

      CREATE TABLE IF NOT EXISTS click_history (
        id SERIAL PRIMARY KEY,
        short_code VARCHAR(30) REFERENCES urls(short_code) ON DELETE CASCADE,
        clicked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        visitor_hash VARCHAR(32),
        user_agent TEXT,
        country VARCHAR(10),
        city VARCHAR(100),
        device_type VARCHAR(20),
        browser VARCHAR(50),
        os VARCHAR(50),
        referrer VARCHAR(255)
      );

      ALTER TABLE urls ADD COLUMN IF NOT EXISTS edit_token VARCHAR(255);
      ALTER TABLE urls ADD COLUMN IF NOT EXISTS title VARCHAR(255);
      ALTER TABLE urls ADD COLUMN IF NOT EXISTS tags VARCHAR(255);
      ALTER TABLE urls ADD COLUMN IF NOT EXISTS device_id VARCHAR(255);
      ALTER TABLE urls ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);
      ALTER TABLE urls ADD COLUMN IF NOT EXISTS routing_rules JSONB DEFAULT '{}'::jsonb;

      ALTER TABLE click_history ADD COLUMN IF NOT EXISTS country VARCHAR(10);
      ALTER TABLE click_history ADD COLUMN IF NOT EXISTS city VARCHAR(100);
      ALTER TABLE click_history ADD COLUMN IF NOT EXISTS device_type VARCHAR(20);
      ALTER TABLE click_history ADD COLUMN IF NOT EXISTS browser VARCHAR(50);
      ALTER TABLE click_history ADD COLUMN IF NOT EXISTS os VARCHAR(50);
      ALTER TABLE click_history ADD COLUMN IF NOT EXISTS referrer VARCHAR(255);

      CREATE INDEX IF NOT EXISTS idx_urls_user_id ON urls (user_id);
      CREATE INDEX IF NOT EXISTS idx_click_history_code_time ON click_history (short_code, clicked_at DESC);
      CREATE INDEX IF NOT EXISTS idx_urls_original_device ON urls (original_url, device_id);
      CREATE INDEX IF NOT EXISTS idx_urls_expires_at ON urls (expires_at) WHERE expires_at IS NOT NULL;
    `;

    await pool.query(schemaSql);
    console.log("✅ Connected to Neon PostgreSQL & Schema Verified");
  } catch (err) {
    console.error("❌ Failed to initialize PostgreSQL:", err);
    process.exit(1);
  }
};

export default pool;
