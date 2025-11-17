# MCP Crypto Wallet FastMCP Server

**MCP Crypto Wallet FastMCP Server** is a production-ready Model Context Protocol (MCP) backend that equips AI assistants with rich EVM wallet operations, cross-chain research, and portfolio analytics. The project now ships with:

- Modular FastMCP tool suites for wallets, DeFi, Wormhole, BSC, Aave, PumpSwap, DeBank, CryptoPanic, and more.
- A built-in observability stack (`/health`, `/status`, `/uptime`) plus an optional FastAPI service that republishes metrics with Swagger documentation.
- Remote MCP federation that can proxy dozens of external MCP servers with namespaced tools.
- Scripts, docs, and Railway configuration for one-click cloud deployment.

---

## Table of Contents
- [Architecture Overview](#architecture-overview)
- [Quick Start (Local Development)](#quick-start-local-development)
- [Tool Catalog](#tool-catalog)
- [Prompt Library](#prompt-library)
- [FastAPI Observability API](#fastapi-observability-api)
- [Integration Examples](#integration-examples)
- [Railway Deployment](#railway-deployment)
- [Environment Variables](#environment-variables)
- [Project Scripts](#project-scripts)
- [Additional Documentation](#additional-documentation)

---

## Architecture Overview

| Layer | Responsibilities |
| --- | --- |
| **FastMCP Core (`src/server`)** | Bootstraps the server, enforces auth tiers, instruments sessions, and exposes MCP transports (stdio + HTTP Stream). |
| **Module Registry (`src/modules`)** | Self-contained tool packs for wallet ops, DeFi quoting, Wormhole bridging, analytics, etc. Each module registers tools, schemas, and handlers. |
| **Middleware (`src/core/middleware.ts`)** | Cross-cutting telemetry: logging, metrics, progress safety, status monitor integration, tier guards, response caching. |
| **Observability (`src/server/status/*`)** | Tracks sessions, tool usage, dependency health (storage ping), and publishes JSON snapshots. |
| **FastAPI Companion (`external/fastapi-layer`)** | REST facade with Swagger for operators and dashboards. Proxies the status server over Railway’s private network or localhost. |
| **Remote MCP Federation (`src/modules/remote`)** | Dynamically connects to other MCP servers when env vars such as `ALPHA_ARENA_MCP_HTTP_URL` are provided, namespacing their tools under prefixes (e.g., `alpha_*`). |

Refer to [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for diagrams and control flow details.

---

## Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- npm 9+
- Python 3.10+ (for the FastAPI status layer)
- Redis (optional; the server will fall back to in-memory storage)

### 1. Install & Build
```bash
npm ci
npm run build
```

### 2. Run the FastMCP Server (stdio)
```bash
npm run start
```

### 3. Run over HTTP Stream (port 8080)
```bash
MCP_TRANSPORT=http HOST=0.0.0.0 PORT=8080 npm run start
```

### 4. Start the FastAPI Observability Layer (optional)
```bash
cd external/fastapi-layer
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
FASTAPI_HOST=0.0.0.0 FASTAPI_PORT=9000 uvicorn app.main:app --reload
```
Swagger UI becomes available at `http://localhost:9000/docs`.

### 5. Run Tests & Linting
```bash
npm test          # Jest suites for every module
npm run lint      # ESLint + TypeScript rules
```

Additional developer notes live in [`docs/fastmcp-migration-plan.md`](docs/fastmcp-migration-plan.md) and [`tool-usage.md`](tool-usage.md).

---

## Tool Catalog

All tool schemas are defined with Zod and automatically exported through MCP discovery (`list_tools`). The following tables summarise the tool surface exposed by the default build (remote connectors add more at runtime):

### Wallet & Provider (`wallet_*`, `provider_*`, `network_*`)
```
wallet_provider_set, wallet_create_random, wallet_from_private_key, wallet_create_mnemonic_phrase,
wallet_from_mnemonic, wallet_from_encrypted_json, wallet_encrypt,
wallet_get_address, wallet_get_public_key, wallet_get_private_key, wallet_get_mnemonic,
wallet_get_balance, wallet_get_chain_id, wallet_get_gas_price, wallet_get_transaction_count,
wallet_call, wallet_send_transaction, wallet_sign_transaction, wallet_populate_transaction,
wallet_sign_message, wallet_sign_typed_data, wallet_verify_message, wallet_verify_typed_data,
provider_get_block, provider_get_transaction, provider_get_transaction_receipt,
provider_get_code, provider_get_storage_at, provider_estimate_gas, provider_get_logs,
provider_get_ens_resolver, provider_lookup_address, provider_resolve_name,
network_get_network, network_get_block_number, network_get_fee_data
```

### Binance Smart Chain (`bsc_*`)
```
bsc_provider_set, bsc_transfer_native, bsc_transfer_token, bsc_token_balance
```

### Wormhole Bridge (`wormhole_*`)
```
wormhole_provider_set, wormhole_bridge_token, wormhole_route_status,
wormhole_supported_routes, wormhole_transfer_status, wormhole_supported_chains
```

### DeFi Aggregator (`defi_*`)
```
defi_provider_set, defi_provider_info, defi_swap_price, defi_swap_quote,
defi_supported_chains, defi_liquidity_sources, defi_token_price,
defi_coingecko_networks, defi_supported_dexes, defi_trending_pools,
defi_convert_wei_to_unit, defi_convert_unit_to_wei
```

### DeBank Portfolio (`debank_*`)
```
debank_provider_set, debank_user_total_balance, debank_user_tokens,
debank_user_protocols, debank_token_info
```

### CryptoPanic News (`cryptopanic_*`)
```
cryptopanic_provider_set, cryptopanic_latest_news
```

### Crypto Projects / DefiLlama (`cryptoprojects_*`)
```
cryptoprojects_provider_set, cryptoprojects_protocol_details, cryptoprojects_top_protocols
```

### Web3 Research / CoinGecko (`web3research_*`)
```
web3research_provider_set, web3research_search_assets,
web3research_asset_details, web3research_trending
```

### PumpSwap (Solana / Jupiter) (`pumpswap_*`)
```
pumpswap_provider_set, pumpswap_price, pumpswap_quote, pumpswap_token_info
```

### Aave V3 Analytics (`aave_*`)
```
aave_provider_set, aave_provider_info, aave_reserves_overview,
aave_analyze_liquidity, aave_user_positions, aave_user_health, aave_namespace_info
```

### Asterdex Market Data (`aster_*`)
```
aster_kline, aster_order_book_ticker, aster_order_book, aster_recent_trades
```

### Remote MCP Federation (`remote/*`)
Any environment variables defined per [`src/core/config.ts`](src/core/config.ts) (for example `ALPHA_ARENA_MCP_HTTP_URL`) will proxy the remote server’s tools using a namespaced prefix (`alpha_*`, `dex_*`, `whale_*`, etc.).

A machine-readable description of the active tool set is also exported in [`tools.json`](tools.json).

---

## Prompt Library

The server registers reusable prompt templates consumable via MCP `list_prompts`:

| Prompt | Description | Key Arguments |
| --- | --- | --- |
| `wallet_transaction_confirmation` | Summarises a pending transaction for human approval. | `to`, `value`, `network`, `gasLimit?`, `gasPrice?` |
| `wallet_troubleshooting_checklist` | Guided debugging checklist for wallet issues. | `scenario`, `network?` |
| `wormhole_bridge_briefing` | Risk checks and follow-up tasks for a Wormhole transfer. | `sourceChain`, `targetChain`, `token`, `amount` |
| `debank_portfolio_digest` | Snapshot of holdings with suggested actions. | `address`, `netWorthUsd?`, `topProtocols?` |
| `aave_health_review` | Highlights borrow/collateral posture and mitigations. | `address`, `healthFactor?`, `totalBorrowsUSD?`, `totalCollateralUSD?` |
| `defi_trade_plan` | Multi-step plan for executing a swap through the aggregator. | `chainId`, `sellToken`, `buyToken`, `sellAmount` |

**Prompt usage example (via `npx fastmcp`):**
```bash
npx fastmcp prompt src/index.ts \
  --name defi_trade_plan \
  --args '{"chainId":1,"sellToken":"0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48","buyToken":"0xC02aaA39b223FE8D0A0E5C4F27eAD9083C756Cc2","sellAmount":"100000000"}'
```

---

## FastAPI Observability API

When the companion service (in `external/fastapi-layer`) is running, the following REST endpoints are exposed:

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/health` | GET | Lightweight probe that returns `ok` when the upstream status server is reachable. |
| `/status` | GET | Full JSON snapshot (service uptime, session list, queue depth, dependency state). Append `?refresh=1` to force dependency rechecks. |
| `/status/dependencies` | GET | Convenience endpoint that returns only the dependency portion of `/status`. |
| `/uptime` | GET | FastAPI process uptime plus the latest upstream uptime reading. |
| `/docs`, `/openapi.json` | GET | Swagger UI and OpenAPI schema automatically generated by FastAPI. |

**Sample request/response**
```bash
curl https://status.example.com/status?refresh=1 | jq '.tools.queueDepth, .dependencies.storage'
```
Output (truncated):
```json
0
{
  "status": "up",
  "latencyMs": 12.4,
  "checkedAt": "2025-11-17T16:02:53.182Z",
  "details": {
    "driver": "redis",
    "namespace": "mcp-cryptowallet"
  }
}
```

The raw status payload mirrors `StatusSnapshot` in [`src/server/status/statusMonitor.ts`](src/server/status/statusMonitor.ts).

---

## Integration Examples

### 1. FastMCP CLI (local testing)
```bash
npx fastmcp call src/index.ts \
  --tool defi_swap_price \
  --args '{"chainId":1,"buyToken":"0xC02aaA39b223FE8D0A0E5C4F27eAD9083C756Cc2","sellToken":"0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48","sellAmount":"100000000"}'
```
Example response:
```json
{
  "content": [
    {
      "type": "text",
      "text": "USDC→WETH indicative price: 0.000625 WETH per USDC (mid)."
    }
  ]
}
```

### 2. Programmatic Client (TypeScript)
```ts
import { Client } from "@modelcontextprotocol/sdk/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp";

const transport = new StreamableHTTPClientTransport(new URL("http://localhost:8080/mcp"));
const client = new Client({ name: "local-integration", version: "1.0.0" });

await client.connect(transport);
const swap = await client.callTool({
  name: "defi_swap_quote",
  arguments: {
    chainId: 1,
    sellToken: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    buyToken: "0xC02aaA39b223FE8D0A0E5C4F27eAD9083C756Cc2",
    sellAmount: "100000000",
    slippageBps: 30
  }
});
console.log(swap);
await transport.close();
```

### 3. ChatGPT / Claude Desktop
- Add this repository’s entrypoint (`npm run start`) to the `mcpServers` section of your configuration.
- Provide the Railway-hosted HTTPS endpoint and bearer token (from `MCP_API_TOKENS`) when configuring ChatGPT Developer Mode or Anthropic.
Detailed instructions live in [`docs/CONNECTORS.md`](docs/CONNECTORS.md).

### 4. Remote MCP Federation
To attach third-party MCP servers, set environment variables such as:
```bash
export ALPHA_ARENA_MCP_HTTP_URL="https://alpha-arena.example.com/mcp"
export ALPHA_ARENA_MCP_AUTH_TOKEN="secret"
```
The server will register tools prefixed with `alpha_*` after startup.

---

## Railway Deployment

This repository includes [`railway.json`](railway.json) describing two services:

1. **`fastmcp-http`** – the FastMCP Node server
   - Installs with `npm ci`, builds with `npm run build`, and starts with HTTP Stream enabled.
   - Binds to IPv6 (`HOST=::`) so the FastAPI service can reach the status endpoint over Railway’s private network.
   - Exposes `/mcp` on the Railway-assigned `$PORT`; `/health` and `/ready` remain available for probes.

2. **`fastapi-status`** – the FastAPI observability layer
   - Lives in `external/fastapi-layer`
   - Uses the internal DNS name `http://fastmcp-http.railway.internal:8090` to fetch status snapshots.
   - Serves Swagger, `/status`, `/uptime`, and `/health` on its own public port/domain.

### Deploy Steps
1. Install the Railway CLI (`npm i -g @railway/cli`) and authenticate with `railway login`.
2. Create a project and run `railway up` from the repo root. Railway will read `railway.json`, build both services, and prompt for variable inputs.
3. Populate secrets via `railway variables set` or the dashboard (see [Environment Variables](#environment-variables)).
4. Assign custom domains if needed—typically one for the MCP endpoint and one for the status API.
5. Configure health checks:
   - `fastmcp-http`: `/ready`
   - `fastapi-status`: `/health`
6. (Optional) Run the CLI probe in cron or CI: `npm run build && STATUS_SERVER_BASE_URL=https://status.example.com npm run monitoring:probe -- --strict`.

For manual deployment guidance and screenshots, see [`monitoring/README.md`](monitoring/README.md) and the Railway-focused section in this README’s [Integration Examples](#integration-examples).

---

## Environment Variables

| Variable | Purpose | Default |
| --- | --- | --- |
| `PRIVATE_KEY` | Default wallet private key (dev only). | _unset_ |
| `PROVIDER_URL` | Base EVM RPC endpoint. | `https://eth.llamarpc.com` |
| `BSC_PROVIDER_URL` | BSC RPC. | `https://bsc-dataseed.binance.org` |
| `WORMHOLE_ENDPOINT`, `WORMHOLE_API_KEY` | Wormhole REST endpoint & auth. | see `.env.example` |
| `DEBANK_ENDPOINT`, `DEBANK_API_KEY` | DeBank portfolio API. | see `.env.example` |
| `CRYPTOPANIC_ENDPOINT`, `CRYPTOPANIC_API_KEY` | CryptoPanic news API. | see `.env.example` |
| `WEB3RESEARCH_ENDPOINT` | CoinGecko API base for research tools. | `https://api.coingecko.com` |
| `CRYPTOPROJECTS_ENDPOINT` | DefiLlama API base. | `https://api.llama.fi` |
| `PUMPSWAP_*` | Jupiter endpoints and slippage defaults. | see `.env.example` |
| `AAVE_SUBGRAPH_URL`, `THEGRAPH_API_KEY` | Aave subgraph endpoint and API key. | see `.env.example` |
| `DEFI_AGGREGATOR_URL` | Custom aggregator base (fallback to defaults if unset). | _unset_ |
| `LOG_LEVEL`, `LOG_PRETTY` | Pino logger configuration. | `info`, `false` |
| `REDIS_URL`, `FASTMCP_STORAGE_NAMESPACE` | Persistent storage configuration. | `_unset_`, `mcp-cryptowallet` |
| `MCP_API_TOKENS` | Comma-separated list of bearer tokens (`token:userId:orgId:tier`). | _unset_ |
| `MCP_DEFAULT_TIER` | Tier applied when no token is present. | `free` |
| `MCP_ALLOW_HTTP`, `MCP_ALLOW_STDIO` | Transport toggles. | `true`, `true` |
| `STATUS_SERVER_ENABLED`, `STATUS_SERVER_HOST`, `STATUS_SERVER_PORT` | Control the embedded status server. | `true`, `0.0.0.0`, `8090` |
| `STATUS_DEPENDENCY_CACHE_TTL_MS`, `STATUS_SERVER_TIMEOUT_MS` | Dependency probe cadence & request timeout. | `15000`, `5000` |
| `STATUS_SERVICE_*`, `FASTAPI_HOST`, `FASTAPI_PORT` | FastAPI observability layer settings. | see `.env.example` |
| `STATUS_PROBE_*` | CLI probe behaviour (`STATUS_PROBE_STRICT`, `STATUS_PROBE_VERBOSE`). | _unset_ |
| Remote MCP envs (`*_MCP_HTTP_URL`, `*_MCP_AUTH_TOKEN`, `*_MCP_HEADERS`) | Enable federated MCP servers. | _unset_ |

The default `.env.example` now reflects all production-ready settings needed for Railway.

---

## Project Scripts

| Command | Description |
| --- | --- |
| `npm run build` | Compile TypeScript into `build/`. |
| `npm run start` | Start the compiled FastMCP server (stdio by default). |
| `npm run dev` | Launch `fastmcp dev` for hot-reload development. |
| `npm run test` | Execute Jest test suites across every module. |
| `npm run lint` | Lint TypeScript sources with ESLint.
| `npm run monitoring:probe` | CLI health probe against the status server (`build/monitoring/probe.js`). |

---

## Additional Documentation
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) – subsystem diagrams & runtime call flow.
- [`docs/CONNECTORS.md`](docs/CONNECTORS.md) – step-by-step setup for ChatGPT, OpenAI Responses API, Claude Desktop, and Cursor.
- [`docs/fastmcp-migration-plan.md`](docs/fastmcp-migration-plan.md) – notes from the FastMCP migration journey.
- [`tool-usage.md`](tool-usage.md) – expanded module usage notes, caching behaviour, and examples.
- [`production-ready-checklist.md`](production-ready-checklist.md) – operational readiness checklist for SaaS deployment.
- [`monitoring/README.md`](monitoring/README.md) – guidance for ALB health checks, UptimeRobot monitors, and the CLI probe.

---

## License
MIT © dcSpark / Nexis-AI
