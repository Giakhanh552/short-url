require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { pool } = require("./db/pool");
const linksRouter = require("./routes/links");
const redirectRouter = require("./routes/redirect");
const { register, metricsMiddleware } = require("./middleware/metrics");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";

app.use(cors());
app.use(express.json({ limit: "32kb" }));
app.use(metricsMiddleware);

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({
      status: "ok",
      service: "url-shortener",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("health check db error", err.message);
    res.status(503).json({
      status: "degraded",
      error: "database unavailable",
      timestamp: new Date().toISOString(),
    });
  }
});

// Metrics: intended for Prometheus scrape on localhost only (Nginx must not expose this)
app.get("/metrics", async (_req, res) => {
  try {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});

app.get("/api/metrics", async (_req, res) => {
  try {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});

app.use("/api/links", linksRouter);
app.use("/r", redirectRouter);

app.use((err, _req, res, _next) => {
  console.error("Unhandled error", err);
  res.status(500).json({ error: "Internal server error" });
});

async function start() {
  // Verify DB on boot (migrate separately via npm run migrate)
  try {
    await pool.query("SELECT 1");
  } catch (err) {
    console.error("Cannot connect to PostgreSQL:", err.message);
    process.exit(1);
  }

  app.listen(PORT, HOST, () => {
    console.log(`URL shortener listening on http://${HOST}:${PORT}`);
  });
}

if (require.main === module) {
  start();
}

module.exports = { app };
