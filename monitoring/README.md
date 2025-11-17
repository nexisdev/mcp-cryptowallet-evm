# Monitoring Integrations

The observability HTTP server (`STATUS_SERVER_*` env) and FastAPI layer expose the probes required by most
infrastructure and uptime providers. This guide documents the recommended wiring for AWS load balancers and
UptimeRobot, and provides a CLI probe for CI or cron-based supervision.

## Available Probe Endpoints

| Endpoint     | Description                                      | Typical consumer            |
|--------------|--------------------------------------------------|-----------------------------|
| `/health`    | Plain-text 200 response; no JSON parsing needed. | AWS ALB/NLB, Kubernetes     |
| `/status`    | Structured JSON payload with metrics snapshots.  | UptimeRobot, Grafana, CI    |
| `/uptime`    | Simplified uptime counters.                      | Dashboards, synthetic checks |

## AWS Load Balancer Target Group

Configure your target group health check to call the dedicated observability server, **not** the MCP `/mcp`
transport endpoint.

```json
{
  "HealthCheckEnabled": true,
  "HealthCheckPath": "/health",
  "HealthCheckProtocol": "HTTP",
  "HealthCheckPort": "traffic-port",
  "Matcher": { "HttpCode": "200" },
  "HealthyThresholdCount": 3,
  "UnhealthyThresholdCount": 3,
  "HealthCheckIntervalSeconds": 15,
  "HealthCheckTimeoutSeconds": 5
}
```

> Use `/status` with a custom Lambda health check if you need to fail targets based on dependency state
> (e.g., Redis outage). The JSON payload includes a `dependencies` object with status values (`up`,
> `degraded`, `down`).

## UptimeRobot / External HTTP Monitors

Create an HTTP monitor pointing at the FastAPI layer. Example configuration:

- URL: `https://api.example.com/status?refresh=1`
- Request method: `GET`
- Monitoring interval: 5 minutes
- Alert on: HTTP status != 200 or body containing `"status":"down"`

You can test the monitor locally with the bundled probe script:

```bash
npm run build
npm run monitoring:probe -- --strict
```

Environment overrides:

- `STATUS_SERVER_BASE_URL` – defaults to `http://127.0.0.1:8090`
- `STATUS_PROBE_TIMEOUT_MS` – defaults to `5000`
- `STATUS_PROBE_STRICT=true` – fail if any dependency reports `down`
- `STATUS_PROBE_VERBOSE=true` – print snapshot summary for debugging

## CI / Cron Probe

Schedule the probe via cron or CI to fail fast when the observability server is unhealthy:

```cron
*/5 * * * * cd /srv/mcp && npm run build && STATUS_SERVER_BASE_URL=https://api.example.com npm run monitoring:probe -- --strict >> /var/log/mcp/probe.log 2>&1
```

Exit codes:

- `0` – all checks passed
- `1` – health endpoint failed, status fetch failed, or a dependency reported `down` (with `--strict`)

