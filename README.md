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

### Verify Remote MCP Integrations
1. Populate the relevant `*_MCP_HTTP_URL` and optional `*_MCP_AUTH_TOKEN` variables in your `.env` (see the [Environment Variables](#environment-variables) table).
2. Start the server in stdio mode so remote connections can initialise (watch for `[remote] integration completed` logs):
   ```bash
   MCP_TRANSPORT=stdio npm run start
   ```
3. In a separate terminal, inspect the active tool surface with the Model Context Protocol inspector:
   ```bash
   npx -y @modelcontextprotocol/inspector npm run start
   ```
   At the inspector prompt run `list_tools` – remote tools appear under their configured prefixes (e.g., `deepresearch_*`, `context7_*`, `omni_tavily_search`).
4. Repeat the process for each environment (staging, production) whenever new remote servers or credentials are introduced.

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
defi_swap_quote_structured,
defi_supported_chains, defi_liquidity_sources, defi_token_price,
defi_coingecko_networks, defi_supported_dexes, defi_trending_pools,
defi_convert_wei_to_unit, defi_convert_unit_to_wei
```

### DeFi Trading (Native) (`defitrading_*`)
```
defitrading_get_swap_price, defitrading_get_swap_quote, defitrading_execute_swap,
defitrading_get_gasless_quote, defitrading_submit_gasless_swap,
defitrading_get_portfolio_tokens, defitrading_get_portfolio_balances,
defitrading_get_portfolio_transactions, defitrading_get_token_price,
defitrading_get_trending_pools, defitrading_search_pools
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

### Lista Vaults (`lista_*`)
```
lista_list_vaults, lista_deposit, lista_redeem, lista_withdraw
```

### Stargate Bridge (`stargate_*`)
```
stargate_list_chains, stargate_list_tokens, stargate_get_quotes, stargate_bridge
```

### Crypto Funds (`cryptofunds_*`)
```
cryptofunds_search, cryptofunds_get_all, cryptofunds_get_basic, cryptofunds_get_detail
```

### Polymarket (`polymarket_*`)
```
polymarket_search_events, polymarket_get_events, polymarket_get_markets
```

### Crypto Stocks (`cryptostocks_*`)
```
cryptostocks_list, cryptostocks_price, cryptostocks_history
```

### Advanced DeFi Workflows (Composite) (`workflow_*`)
```
workflow_omnichain_yield_farmer, workflow_leverage_looper, workflow_delta_neutral_yield,
workflow_allowance_revoker, workflow_mint_sniper
```

### Remote MCP Federation (`remote/*`)
Any environment variables defined per [`src/core/config.ts`](src/core/config.ts) (for example `ALPHA_ARENA_MCP_HTTP_URL`) will proxy the remote server’s tools using a namespaced prefix (`alpha_*`, `dex_*`, `whale_*`, etc.). Set `*_MCP_HTTP_URL` (or `*_MCP_URL`) plus optional `*_MCP_AUTH_TOKEN` / `*_MCP_HEADERS` JSON to enable.
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
| `lista_vault_strategy` | Analyze Lista DAO vaults and suggest a deposit strategy. | `zone?`, `amount?` |
| `stargate_bridge_plan` | Plan a cross-chain transfer via Stargate. | `srcChain`, `dstChain`, `token`, `amount` |
| `cryptofunds_analysis` | Analyze crypto funds and their portfolios. | `focus` |
| `polymarket_event_scout` | Find and analyze prediction markets on Polymarket. | `topic` |
| `cryptostocks_summary` | Summarize performance of crypto-related equities. | `tickers` |
| `aster_market_depth` | Analyze order book depth and recent trades for a symbol on Aster. | `symbol`, `limit?` |
| `bsc_transfer_checklist` | Safety checks before sending BNB or BEP-20 tokens. | `recipient`, `token`, `amount` |
| `cryptopanic_news_digest` | Summarize latest news for a specific currency or filter. | `currency?`, `filter?` |
| `cryptoprojects_protocol_audit` | Deep dive into a protocol's TVL and details via DefiLlama. | `slug` |
| `pumpswap_trade_setup` | Prepare a trade on Solana via Jupiter. | `inputMint`, `outputMint`, `amount` |
| `web3research_asset_report` | Comprehensive report on an asset using CoinGecko data. | `theme`, `budgetSol?`, `roomId?` |
| `cross_chain_bridge_optimizer` | Find the best route to bridge assets across chains. | `asset`, `amount`, `sourceChain`, `destChain` |
| `smart_contract_auditor` | Perform a quick security audit on a contract. | `contractAddress`, `chain` |
| `nft_floor_sweeper` | Strategy to sweep the floor of an NFT collection. | `collection`, `maxPrice`, `count` |
| `airdrop_farmer_route` | Generate a route for airdrop farming. | `targetProject` |
| `health_factor_guardian` | Monitor DeFi health factor and protect against liquidation. | `protocol`, `minHealth` |
| `evm_yield_farmer` | Find the best yield farming opportunities on EVM chains. | `chain`, `asset` |
| `market_research_deep_dive` | Conduct a deep dive research on a specific crypto project or topic. | `topic` |
| `evm_token_creator_guide` | Guide to creating and deploying an ERC20 token. | `name`, `symbol` |
| `cross_chain_yield_aggregator` | Compare yields across multiple chains for a specific asset. | `asset` |
| `project_due_diligence` | Perform due diligence on a project before investing. | `projectName` |
| `evm_whale_watch` | Monitor large transactions on EVM chains. | `address` |
| `yield_opportunity_alert` | Alert on new high-yield opportunities. | `minApy` |
| `token_launch_strategy` | Strategic plan for launching a new token. | `projectType` |
| `market_sentiment_report` | Generate a report on overall market sentiment. | |
| `defi_protocol_analyzer` | Analyze a specific DeFi protocol's health. | `protocol` |

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

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/new?template=https://raw.githubusercontent.com/0xnexis/mcp-cryptowallet-evm/main/templates/railway.template.json)

[`templates/railway.template.json`](templates/railway.template.json) packages a complete Railway stack so the FastMCP server, Redis cache layer, and FastAPI observability service are created together. The template delegates build commands and per-service configuration to [`railway.json`](railway.json), which keeps install/build/start definitions source-controlled alongside the application code.citeturn14search0turn15search0
- **`fastmcp-http`** – builds the FastMCP server with `npm ci && npm run build`, runs HTTP Stream transport on the platform port, and exposes `/mcp` plus `/health` for probes.
- **`fastapi-status`** – launches the FastAPI companion from `external/fastapi-layer` and consumes the FastMCP status endpoint over Railway’s private DNS (`http://fastmcp-http.railway.internal:8090`).
- **`redis`** – provisions the managed Redis plugin and injects its connection string into `fastmcp-http` via the `${{redis.REDIS_URL}}` interpolation so storage is stateful out of the box.

Environment-level defaults (RPC endpoints, logging flags, FastAPI tuning) are carried in the `production` block of the config, while service-level variables pull from the shared namespace using Railway’s variable template syntax (`${{namespace.KEY}}`).citeturn14search0

### One-click deployment flow
1. Click the button above or visit the Railway dashboard and import this repository; the platform automatically detects `railway.json` and prepares all three services.
2. When prompted, set secrets such as `PRIVATE_KEY`, upstream API keys, and optional MCP federation URLs listed in [.env.example](.env.example). Leave `MCP_API_TOKENS` empty to start in anonymous `free` tier mode.
3. Trigger the first deploy. Railway will sequentially stand up Redis, the FastMCP service, and the FastAPI status API. Internal service discovery means the FastAPI process can reach FastMCP via `fastmcp-http.railway.internal` without extra networking work.citeturn15search0
4. After both application services are healthy, assign custom domains if you need public endpoints (e.g. `/mcp` for MCP clients and `/status` for operators).
5. Run a post-deploy smoke test from CI or your terminal:
   ```bash
   railway run --service fastmcp-http npm run monitoring:probe -- --strict
   ```
   or curl the FastAPI `/health` endpoint on the assigned domain to confirm cross-service wiring.

Redis credentials and other managed resource variables are automatically injected into dependent services, so no manual copying of connection strings is required.citeturn16search0

Need to tweak behaviour per environment? Add new environments under `environments.{name}.variables` and Railway will merge those overrides on the next deployment. The monitoring guide in [`monitoring/README.md`](monitoring/README.md) covers health-check wiring and alerting once production traffic is flowing.

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
| `CACHE_TTL_MULTIPLIER_FREE`, `CACHE_TTL_MULTIPLIER_PRO`, `CACHE_TTL_MULTIPLIER_ULTRA` | Optional per-tier cache multipliers (e.g., `0.5` for fresher Pro results). | `1` |
| `CACHE_TTL_FREE_MS`, `CACHE_TTL_PRO_MS`, `CACHE_TTL_ULTRA_MS` | Absolute TTL overrides (take precedence over multipliers) for cache entries per tier. | _unset_ |
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
MIT © Nexis Labs
