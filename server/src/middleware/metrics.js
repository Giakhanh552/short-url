const client = require("prom-client");

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

const linksCreatedTotal = new client.Counter({
  name: "links_created_total",
  help: "Total number of shortened links created",
  registers: [register],
});

const linkClicksTotal = new client.Counter({
  name: "link_clicks_total",
  help: "Total number of redirect clicks",
  registers: [register],
});

function metricsMiddleware(req, res, next) {
  if (req.path === "/metrics" || req.path === "/api/metrics") {
    return next();
  }

  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationNs = Number(process.hrtime.bigint() - start);
    const durationSec = durationNs / 1e9;
    const route = req.route?.path
      ? `${req.baseUrl}${req.route.path}`
      : req.path;
    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    };
    httpRequestDuration.observe(labels, durationSec);
    httpRequestsTotal.inc(labels);
  });

  next();
}

module.exports = {
  register,
  metricsMiddleware,
  linksCreatedTotal,
  linkClicksTotal,
};
