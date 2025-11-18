# FastAPI Wallet + Observability Layer

This companion service exposes REST endpoints (with Swagger) that mirror the MCP server's health and status
signals **and** provides authenticated wallet-transaction orchestration for thirdweb bridge/swap flows. It is
designed for REST consumers, infrastructure probes, and human-in-the-loop transaction dashboards while the core
MCP server continues to serve LLM transports.

## Features

- `/health` – Probes the MCP observability server and returns plain-text `ok`.
- `/status` – Returns the structured JSON snapshot from the MCP status server.
- `/status/dependencies` – Streams dependency probe results (Redis, storage, etc.).
- `/uptime` – Reports both FastAPI process uptime and upstream MCP uptime.
- `/wallets/intents` – Executes wallet transaction intents (bridge / swap) against thirdweb infrastructure with tier
  gating, header-based authentication, and detailed diagnostics.
- `/docs` – Interactive Swagger UI for operators and REST integrations.

## Configuration

| Environment variable         | Default                 | Description                                                                                               |
|------------------------------|-------------------------|-----------------------------------------------------------------------------------------------------------|
| `STATUS_SERVICE_BASE_URL`    | `http://127.0.0.1:8090` | Base URL for the Node status server (`/status`, `/health`).                                               |
| `STATUS_SERVICE_TIMEOUT`     | `5.0`                   | Timeout (seconds) for upstream HTTP calls.                                                                |
| `STATUS_SERVICE_API_KEY`     | _unset_                 | Optional bearer token injected into upstream requests.                                                    |
| `STATUS_SERVICE_WARMUP`      | `1`                     | Set to `0`/`false` to skip warmup probe on startup.                                                       |
| `FASTAPI_LAYER_VERSION`      | `1.0.0`                 | Overrides the version reported in the OpenAPI schema.                                                     |
| `FASTAPI_HOST`               | `0.0.0.0`               | Bind address for `uvicorn`.                                                                               |
| `FASTAPI_PORT`               | `9000`                  | Listen port for the FastAPI service.                                                                      |
| `FASTAPI_API_KEYS`           | _unset_                 | JSON array of API key definitions (`[{ "key": "...", "tier": "paid", "scopes": ["wallet:bridge"] }]`).     |
| `THIRDWEB_SECRET_KEY`        | _unset_                 | Server-side thirdweb secret key used for bridge/swap execution.                                           |
| `THIRDWEB_CLIENT_ID`         | _unset_                 | Optional thirdweb client ID (used when secret key is not supplied).                                       |
| `THIRDWEB_API_BASE_URL`      | `https://api.thirdweb.com` | Override the thirdweb API base URL (useful for staging environments).                                 |

You can define these variables in a `.env` file (loaded automatically by `uvicorn` when using `python-dotenv`).

## Installation & Local Run

```bash
cd external/fastapi-layer
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
FASTAPI_HOST=0.0.0.0 FASTAPI_PORT=9000 uvicorn app.main:app --reload
```

After launch:

- Swagger UI: `http://localhost:9000/docs`
- OpenAPI JSON: `http://localhost:9000/openapi.json`
- Health probe: `http://localhost:9000/health`
- Status: `http://localhost:9000/status`
- Wallet transaction execution: `POST http://localhost:9000/wallets/intents`

## Deployment Notes

- Run this service close to the MCP server to minimise latency to the `/status` endpoints.
- If the MCP status server requires authentication, set `STATUS_SERVICE_API_KEY` to match the bearer token.
- Use process supervision (systemd, Docker, Kubernetes) to restart on failure; `uvicorn` will exit with a
  non-zero status if the upstream warmup probe fails repeatedly.
- Wallet endpoints enforce header-based authentication and scope/tier controls. Populate `FASTAPI_API_KEYS` with the
  allowed keys, tiers, and scopes (e.g. `["wallet:bridge","wallet:swap"]`). Thirdweb credentials must be supplied via
  `THIRDWEB_SECRET_KEY` or `THIRDWEB_CLIENT_ID` before bridge/swap intents will succeed.
