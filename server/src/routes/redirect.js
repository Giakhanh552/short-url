const express = require("express");
const { pool } = require("../db/pool");
const { isValidShortCode } = require("../utils/url");
const { linkClicksTotal } = require("../middleware/metrics");

const router = express.Router();

// GET /r/:code — redirect and count click
router.get("/:code", async (req, res) => {
  const { code } = req.params;
  if (!isValidShortCode(code)) {
    return res.status(400).json({ error: "Invalid short code" });
  }

  try {
    const result = await pool.query(
      `UPDATE links
       SET clicks = clicks + 1, updated_at = NOW()
       WHERE short_code = $1
       RETURNING long_url`,
      [code]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Short link not found" });
    }

    linkClicksTotal.inc();
    res.redirect(302, result.rows[0].long_url);
  } catch (err) {
    console.error("GET /r/:code", err);
    res.status(500).json({ error: "Redirect failed" });
  }
});

module.exports = router;
