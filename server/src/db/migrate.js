require("dotenv").config({ path: require("path").resolve(__dirname, "../../../.env") });
require("dotenv").config();

const { pool } = require("./pool");

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS links (
        id SERIAL PRIMARY KEY,
        short_code VARCHAR(32) NOT NULL UNIQUE,
        long_url TEXT NOT NULL,
        clicks INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_links_short_code ON links (short_code);
      CREATE INDEX IF NOT EXISTS idx_links_created_at ON links (created_at DESC);
    `);
    console.log("Migration complete: links table ready");
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
