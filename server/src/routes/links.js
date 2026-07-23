const express = require("express");
const { pool } = require("../db/pool");
const {
  validateUrl,
  generateShortCode,
  isValidShortCode,
} = require("../utils/url");
const { linksCreatedTotal } = require("../middleware/metrics");

const router = express.Router();

function mapLink(row) {
  return {
    id: row.id,
    shortCode: row.short_code,
    longUrl: row.long_url,
    clicks: row.clicks,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function createUniqueShortCode(client, attempts = 8) {
  for (let i = 0; i < attempts; i += 1) {
    const code = generateShortCode(7);
    const exists = await client.query(
      "SELECT 1 FROM links WHERE short_code = $1",
      [code]
    );
    if (exists.rowCount === 0) return code;
  }
  throw new Error("Could not generate unique short code");
}

// GET /api/links
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM links ORDER BY created_at DESC LIMIT 200"
    );
    res.json({ data: result.rows.map(mapLink) });
  } catch (err) {
    console.error("GET /api/links", err);
    res.status(500).json({ error: "Failed to list links" });
  }
});

// GET /api/links/:id
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "Invalid id" });
  }

  try {
    const result = await pool.query("SELECT * FROM links WHERE id = $1", [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Link not found" });
    }
    res.json({ data: mapLink(result.rows[0]) });
  } catch (err) {
    console.error("GET /api/links/:id", err);
    res.status(500).json({ error: "Failed to get link" });
  }
});

// POST /api/links
router.post("/", async (req, res) => {
  const validation = validateUrl(req.body?.longUrl ?? req.body?.long_url);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.error });
  }

  const customCode = req.body?.shortCode ?? req.body?.short_code;
  if (customCode != null && customCode !== "") {
    if (!isValidShortCode(customCode)) {
      return res.status(400).json({
        error: "shortCode must be 4–32 alphanumeric characters",
      });
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const shortCode =
      customCode && customCode !== ""
        ? customCode
        : await createUniqueShortCode(client);

    const result = await client.query(
      `INSERT INTO links (short_code, long_url)
       VALUES ($1, $2)
       RETURNING *`,
      [shortCode, validation.url]
    );
    await client.query("COMMIT");
    linksCreatedTotal.inc();
    res.status(201).json({ data: mapLink(result.rows[0]) });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505") {
      return res.status(409).json({ error: "shortCode already exists" });
    }
    console.error("POST /api/links", err);
    res.status(500).json({ error: "Failed to create link" });
  } finally {
    client.release();
  }
});

// PUT /api/links/:id
router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "Invalid id" });
  }

  const validation = validateUrl(req.body?.longUrl ?? req.body?.long_url);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    const result = await pool.query(
      `UPDATE links
       SET long_url = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [validation.url, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Link not found" });
    }
    res.json({ data: mapLink(result.rows[0]) });
  } catch (err) {
    console.error("PUT /api/links/:id", err);
    res.status(500).json({ error: "Failed to update link" });
  }
});

// DELETE /api/links/:id
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "Invalid id" });
  }

  try {
    const result = await pool.query(
      "DELETE FROM links WHERE id = $1 RETURNING id",
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Link not found" });
    }
    res.status(204).send();
  } catch (err) {
    console.error("DELETE /api/links/:id", err);
    res.status(500).json({ error: "Failed to delete link" });
  }
});

module.exports = router;
