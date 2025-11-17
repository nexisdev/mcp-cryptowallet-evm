# MCP Crypto Wallet FastMCP Server

This repository hosts a production-ready [FastMCP](https://gofastmcp.com) server that equips AI assistants with on-chain tooling across:

- **EVM Wallet Module** – Ethereum & compatible networks via `ethers@5`
- **BSC Module** – BEP‑20 native/token transfers with shared middleware
- **Wormhole Module** – cross-chain bridging orchestration with REST API integration, progress telemetry, and response caching
- **Reusable Prompts & Middleware** – contextual logging, telemetry, and response caching helpers

The server supports both stdio and HTTP Stream transports, making it compatible with Claude Desktop, ChatGPT Developer Mode, and the OpenAI Responses API.

---

## Quick Start

```bash
git clone https://github.com/dcSpark/mcp-cryptowallet-evm.git
cd mcp-cryptowallet-evm
npm ci
```

| Command | Description |
| --- | --- |
| `npm run dev` | Launch FastMCP in dev mode (`fastmcp dev src/index.ts`) |
| `npm run build` | Compile TypeScript to `build/` |
| `npm run start` | Run compiled server (stdio by default) |
| `MCP_TRANSPORT=http PORT=8080 npm run start` | Start HTTP Stream transport binding to `0.0.0.0:8080` |
| `npm run test` | Execute Jest suites with mocked ethers/FastMCP |
| `npm run lint` | ESLint (TypeScript + FastMCP rules) |

---

## Environment Variables

| Variable | Purpose | Default |
| --- | --- | --- |
| `PRIVATE_KEY` | Default wallet used when no wallet data provided | _unset_ |
| `PROVIDER_URL` | EVM RPC endpoint | `https://eth.llamarpc.com` |
| `BSC_PROVIDER_URL` | BSC RPC endpoint | `https://bsc-dataseed.binance.org` |
| `WORMHOLE_ENDPOINT` | Wormhole API/base URL | `https://api.testnet.wormhole.com` |
| `WORMHOLE_API_KEY` | Optional API key for authenticated Wormhole routes | _unset_ |
| `DEBANK_ENDPOINT` | DeBank API base URL | `https://openapi.debank.com` |
| `DEBANK_API_KEY` | Optional DeBank API access key | _unset_ |
| `CRYPTOPANIC_ENDPOINT` | CryptoPanic API base URL | `https://cryptopanic.com` |
| `CRYPTOPANIC_API_KEY` | Optional CryptoPanic API token | _unset_ |
| `WEB3RESEARCH_ENDPOINT` | CoinGecko API base URL | `https://api.coingecko.com` |
| `CRYPTOPROJECTS_ENDPOINT` | DefiLlama API base URL | `https://api.llama.fi` |
| `PUMPSWAP_QUOTE_ENDPOINT` | Jupiter quote API | `https://quote-api.jup.ag` |
| `PUMPSWAP_PRICE_ENDPOINT` | Jupiter price API | `https://price.jup.ag` |
| `PUMPSWAP_TOKEN_ENDPOINT` | Jupiter token metadata API | `https://tokens.jup.ag` |
| `PUMPSWAP_DEFAULT_SLIPPAGE_BPS` | Default PumpSwap slippage tolerance (basis points) | `50` |
| `DEFI_AGGREGATOR_URL` | Default DeFi swap aggregator base URL | `http://44.252.136.98` |
| `COINGECKO_API_KEY` | Optional CoinGecko Onchain API key for DeFi analytics | _unset_ |
| `STATUS_SERVER_ENABLED` | Enable the observability HTTP server | `true` |
| `STATUS_SERVER_HOST` | Bind address for observability server | `0.0.0.0` |
| `STATUS_SERVER_PORT` | Port for `/health`, `/status`, `/uptime` endpoints | `8090` |
| `STATUS_SERVER_CORS_ENABLED` | Allow CORS on observability endpoints | `false` |
| `STATUS_SERVER_CORS_ORIGIN` | Explicit CORS origin when enabled | _unset_ |
| `STATUS_DEPENDENCY_CACHE_TTL_MS` | Cache duration for dependency probes | `15000` |
| `STATUS_SERVER_TIMEOUT_MS` | Per-request timeout for observability server | `5000` |
| `STATUS_SERVICE_BASE_URL` | FastAPI layer upstream (`/status`) | `http://127.0.0.1:8090` |
| `STATUS_SERVICE_TIMEOUT` | FastAPI upstream timeout (seconds) | `5` |
| `STATUS_SERVICE_API_KEY` | Optional bearer token for upstream calls | _unset_ |
| `STATUS_SERVICE_WARMUP` | Warmup probe on FastAPI startup (`1`/`0`) | `1` |
| `FASTAPI_HOST` | FastAPI layer bind host | `0.0.0.0` |
| `FASTAPI_PORT` | FastAPI layer port | `9000` |
| `FASTAPI_LAYER_VERSION` | Version string exposed in Swagger | `1.0.0` |
| `PORT`, `HOST`, `MCP_TRANSPORT`, `MCP_HTTP_ENDPOINT`, `FASTMCP_STATELESS` | Transport configuration (see `src/server/startServer.ts`) | varies |

Copy `.env` and adjust as needed:

```bash
cp .env .env.local
```

---

## Modules & Tools

### Wallet (EVM)

- `wallet_provider_set`, `wallet_create_random`, `wallet_from_private_key`, `wallet_from_mnemonic`, `wallet_from_encrypted_json`, `wallet_encrypt`
- `wallet_get_address`, `wallet_get_public_key`, `wallet_get_private_key`, `wallet_get_balance`, `wallet_get_chain_id`, `wallet_get_gas_price`, `wallet_get_transaction_count`
- `wallet_get_mnemonic`
- `wallet_call`, `wallet_send_transaction`, `wallet_sign_transaction`, `wallet_populate_transaction`
- `wallet_sign_message`, `wallet_sign_typed_data`, `wallet_verify_message`, `wallet_verify_typed_data`
- Provider utilities: `provider_get_block`, `provider_get_transaction`, `provider_get_transaction_receipt`, `provider_get_code`, `provider_get_storage_at`, `provider_estimate_gas`, `provider_get_logs`, `provider_get_ens_resolver`, `provider_lookup_address`, `provider_resolve_name`
- Network utilities: `network_get_network`, `network_get_block_number`, `network_get_fee_data`

### BSC

- `bsc_provider_set`
- `bsc_transfer_native`
- `bsc_transfer_token`
- `bsc_token_balance` (read-only cached)

### Wormhole

- `wormhole_provider_set`
- `wormhole_bridge_token` (progress reporting + telemetry; REST quote + transfer creation)
- `wormhole_route_status` (cached latency lookup)
- `wormhole_supported_routes` (cached catalogue)
- `wormhole_transfer_status` (inspect a transfer lifecycle)
- `wormhole_supported_chains` (static helper)

### DeBank

- `debank_provider_set`
- `debank_portfolio_overview`
- `debank_protocol_list`

### DeFi Aggregator

- `defi_provider_set`
- `defi_provider_info`
- `defi_swap_price`
- `defi_swap_quote`
- `defi_supported_chains`
- `defi_liquidity_sources`
- `defi_token_price`
- `defi_coingecko_networks`
- `defi_supported_dexes`
- `defi_trending_pools`
- `defi_convert_wei_to_unit`
- `defi_convert_unit_to_wei`

### CryptoPanic

- `cryptopanic_provider_set`
- `cryptopanic_latest_news` (cached news/media feed with filters)

### Web3 Research

- `web3research_provider_set`
- `web3research_search_assets`
- `web3research_asset_details`
- `web3research_trending`

### Crypto Projects

- `cryptoprojects_provider_set`
- `cryptoprojects_protocol_details`
- `cryptoprojects_top_protocols`

### PumpSwap (Solana)

- `pumpswap_provider_set`
- `pumpswap_price`
- `pumpswap_quote`
- `pumpswap_token_info`

### Aave

- `aave_provider_set`
- `aave_provider_info`
- `aave_reserves_overview`
- `aave_analyze_liquidity`
- `aave_user_positions`
- `aave_user_health`
- `aave_namespace_info`

### Prompts

- `wallet_transaction_confirmation`
- `wallet_troubleshooting_checklist`
- `wormhole_bridge_briefing`
- `debank_portfolio_digest`
- `cryptopanic_news_brief`
- `pumpswap_trade_brief`

Each tool is wrapped with telemetry & progress middleware, and selective tools use the response caching middleware defined in `src/core/cache.ts`.

---

## Observability & Monitoring

- The Node status server exposes `/health`, `/status`, and `/uptime` (JSON) from the port configured by `STATUS_SERVER_PORT`.
- The status payload includes queue depth, active sessions, tool execution history, and dependency probes (storage health by default).
- A companion FastAPI service (`external/fastapi-layer`) republishes the same data with Swagger UI at `/docs`. Deploy it alongside the MCP server when REST clients or operators need OpenAPI documentation.
- Use `npm run monitoring:probe` (after `npm run build`) to execute CLI health checks suitable for cron/CI.
- See [`monitoring/README.md`](monitoring/README.md) for AWS ALB and UptimeRobot integration examples.

---

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) – system layout, capability coverage, rollout checkpoints.
- [`docs/CONNECTORS.md`](docs/CONNECTORS.md) – ChatGPT, OpenAI Responses API, and desktop MCP integration steps.
- [`tool-usage.md`](tool-usage.md) – module-by-module tool guidance and caching notes.
- [`external/fastapi-layer/README.md`](external/fastapi-layer/README.md) – FastAPI observability layer instructions.
- [`monitoring/README.md`](monitoring/README.md) – Monitoring wiring (AWS ALB, UptimeRobot, CLI probe).

---

## Client Integration

- ### Claude Desktop / Cursor  
  Add the server to your MCP configuration. Example:
  ```json
  {
    "mcpServers": {
      "mcp-cryptowallet-fastmcp": {
        "command": "npm",
        "args": ["run", "start"],
        "cwd": "/absolute/path/to/mcp-cryptowallet-evm"
      }
    }
  }
  ```

- ### ChatGPT Developer Mode / OpenAI Responses API  
  See [`docs/CONNECTORS.md`](docs/CONNECTORS.md) for connector payloads, Deep Research requirements, and authentication notes.

- ### FastMCP CLI  
  ```bash
  npm run dev
  # then in another terminal:
  npx fastmcp inspect src/index.ts
  ```

---

## Quality Gates

| Check | Command |
| --- | --- |
| TypeScript compile | `npm run build` |
| Unit tests (wallet, BSC, Wormhole) | `npm run test` |
| Lint (ESLint + @typescript-eslint) | `npm run lint` |

Tests rely on deterministic mocks in `tests/mocks/` for `fastmcp` and `ethers`, enabling CI-safe execution without RPC access.

---

## Folder Map

```
src/
  core/               shared middleware & cache helpers
  modules/
    wallet/           FastMCP wallet tools
    bsc/              BSC module
    wormhole/         Wormhole bridge simulation
    debank/           Portfolio analytics
    cryptopanic/      News aggregation
    web3research/     Asset research endpoints
    cryptoprojects/   Protocol analytics
    pumpswap/         Solana trading tools
  prompts/            FastMCP prompt registration
  server/             createServer/startServer helpers
tests/
  mocks/              FastMCP & ethers mocks
  modules/            Jest suites per module
changelog/            Phase-by-phase change tracking
external/             Additional MCP servers pending integration review
```

---

## Example Prompts

- “Create a new wallet, encrypt it with password `delta123`, and show the address.”
- “Send 0.05 BNB from my default wallet to `0xabc...` on BSC.”
- “Bridge 25 USDC from Ethereum to BSC and report the estimated arrival time.”
- “Summarize the latest BTC and ETH headlines from CryptoPanic.”

---
## License

MIT © dcSpark & contributors.
