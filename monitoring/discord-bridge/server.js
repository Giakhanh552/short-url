const http = require("http");

const PORT = Number(process.env.PORT || 9094);
const WEBHOOK = process.env.DISCORD_WEBHOOK_URL || "";

function severityColor(severity, status) {
  if (status === "resolved") return 5763719; // green
  if (severity === "critical") return 15548997; // red
  return 16776960; // yellow
}

function formatAlert(payload) {
  const status = payload.status || "firing";
  const alerts = payload.alerts || [];
  const embeds = alerts.slice(0, 8).map((a) => {
    const name = a.labels?.alertname || "Alert";
    const sev = a.labels?.severity || "unknown";
    const summary = a.annotations?.summary || "";
    const description = a.annotations?.description || "";
    const runbook = a.annotations?.runbook || "";
    const state = (a.status || status).toUpperCase();

    let content = `**${state}** · \`${name}\` (${sev})\n${summary}`;
    if (description) content += `\n${description}`;
    if (runbook) content += `\n\n**Runbook:** ${runbook}`;

    return {
      title: state === "RESOLVED" ? `RESOLVED: ${name}` : `FIRING: ${name}`,
      description: content.slice(0, 4000),
      color: severityColor(sev, a.status || status),
      timestamp: a.endsAt && a.endsAt !== "0001-01-01T00:00:00Z" ? a.endsAt : a.startsAt,
    };
  });

  return {
    username: "Alertmanager",
    embeds: embeds.length
      ? embeds
      : [
          {
            title: status.toUpperCase(),
            description: "Alertmanager notification",
            color: severityColor("warning", status),
          },
        ],
  };
}

async function postDiscord(body) {
  if (!WEBHOOK || WEBHOOK.includes("PLACEHOLDER")) {
    console.error("DISCORD_WEBHOOK_URL is not configured");
    return false;
  }
  const res = await fetch(WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("Discord webhook failed", res.status, text);
    return false;
  }
  return true;
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(405);
    res.end();
    return;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");

  let payload;
  try {
    payload = JSON.parse(raw || "{}");
  } catch {
    res.writeHead(400);
    res.end("invalid json");
    return;
  }

  try {
    const ok = await postDiscord(formatAlert(payload));
    res.writeHead(ok ? 204 : 502);
    res.end();
  } catch (err) {
    console.error(err);
    res.writeHead(500);
    res.end();
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Discord bridge listening on 127.0.0.1:${PORT}`);
});
