# FastMCP Connector Reference

This guide summarises how to expose the FastMCP crypto wallet server to downstream AI platforms.

---

## 1. ChatGPT (Developer Mode)

1. Enable **Developer Mode** in ChatGPT → Settings → Connectors.
2. Create a connector:
   - **Name**: `mcp-cryptowallet`
   - **Server URL**: `https://your-domain.example/mcp/`
   - **Require approval**: `never`
   - Optional headers:
     ```json
     {
       "Authorization": "Bearer YOUR_TOKEN"
     }
     ```
3. Start a new chat, press **+ → Developer Mode**, enable the connector.

### Deep Research Requirements

- Ensure the connector exposes `wormhole_route_status` or other read-only tools as `search`/`fetch` equivalents if needed.
- Add caching middleware (already provided) to avoid rate-limit friction.

---

## 2. OpenAI Responses API

```ts
import { OpenAI } from "openai";

const client = new OpenAI();

const response = await client.responses.create({
  model: "gpt-4.1",
  tools: [
    {
      type: "mcp",
      server_label: "crypto_wallet",
      server_url: "https://your-domain.example/mcp/",
      require_approval: "never",
      headers: {
        Authorization: `Bearer ${process.env.MCP_TOKEN}`,
      },
    },
  ],
  input: "Bridge 25 USDC from Ethereum to BSC.",
});
```

---

## 3. Claude Desktop / Cursor

Update your MCP config file:

```json
{
  "mcpServers": {
    "mcp-cryptowallet": {
      "command": "npm",
      "args": ["run", "start"],
      "cwd": "/absolute/path/to/mcp-cryptowallet-evm",
      "env": {
        "PROVIDER_URL": "https://eth.llamarpc.com",
        "BSC_PROVIDER_URL": "https://bsc-dataseed.binance.org",
        "WORMHOLE_ENDPOINT": "https://api.testnet.wormhole.com",
        "WORMHOLE_API_KEY": "optional-wormhole-key",
        "DEBANK_ENDPOINT": "https://openapi.debank.com",
        "DEBANK_API_KEY": "optional-debank-key",
        "CRYPTOPANIC_ENDPOINT": "https://cryptopanic.com",
        "CRYPTOPANIC_API_KEY": "optional-cryptopanic-token",
        "WEB3RESEARCH_ENDPOINT": "https://api.coingecko.com",
        "CRYPTOPROJECTS_ENDPOINT": "https://api.llama.fi",
        "PUMPSWAP_QUOTE_ENDPOINT": "https://quote-api.jup.ag",
        "PUMPSWAP_PRICE_ENDPOINT": "https://price.jup.ag",
        "PUMPSWAP_TOKEN_ENDPOINT": "https://tokens.jup.ag",
        "PUMPSWAP_DEFAULT_SLIPPAGE_BPS": "50",
        "DEFI_AGGREGATOR_URL": "https://aggregator.your-domain.example",
        "COINGECKO_API_KEY": "optional-coingecko-key",
        "ASTER_BASE_URL": "https://fapi.asterdex.com",
        "LOG_LEVEL": "info",
        "REDIS_URL": "redis://127.0.0.1:6379",
        "MCP_API_TOKENS": "demo-token:user-1:org-1:pro",
        "MCP_DEFAULT_TIER": "free",
        "MCP_ALLOW_HTTP": "true",
        "MCP_ALLOW_STDIO": "true"
      }
    }
  }
}
```

Restart the client to pick up the new server.

---

## 4. Runtime Configuration

- **Structured logging**: control verbosity with `LOG_LEVEL` (`debug`, `info`, etc.) and enable pretty output locally via `LOG_PRETTY=true`.
- **Storage backend**: set `REDIS_URL` to persist session state, usage metrics, and per-module provider overrides. Leave empty for in-memory dev mode.
- **Session tiers**: define comma-separated entries in `MCP_API_TOKENS` (`token:userId:orgId:tier`). Clients without a matching token inherit `MCP_DEFAULT_TIER`.
- **Transport guardrails**: toggle HTTP and STDIO availability with `MCP_ALLOW_HTTP` / `MCP_ALLOW_STDIO`; `MCP_TRANSPORT=http` still honours these gates.
- **Remote MCP proxies**: configure `*_MCP_HTTP_URL` (plus optional `_AUTH_TOKEN` or `_HEADERS`) for the bundled connectors: Alpha Arena, DEX Pools, Polymarket, Hyperliquid Info, Freqtrade, Hyperliquid Whale Alert, Wallet Inspector, Ethereum Validators Queue, and the full Kukapay catalog (FindBlock, Pumpfun Wallets, Honeypot Detector, ENS Toolkit, Chainlist, Rug Check, NFT Analytics, Crypto Projects, Solana Launchpads, Memecoin Radar, Crypto Whitepapers, Token Minter, World Clock, Nearby Search). Unset prefixes are skipped with a warning.

---

## 5. Health & Observability

- HTTP transport exposes `/mcp` (JSON-RPC), `/sse` (SSE), and optional `/health` endpoints (configure in `startServer.ts`).
- Telemetry middleware sends structured logs via Pino; ship them to CloudWatch/ELK by attaching a transport in `LOG_LEVEL` configuration.
- Tool metrics (duration, success/failure) are stored per-session in Redis under the `telemetry:tool-usage` namespace.

---

## 6. Security Notes

- Gate HTTP access behind a reverse proxy and terminate TLS there.
- Require Bearer tokens defined in `MCP_API_TOKENS` when exposing the server publicly; unauthenticated HTTP requests are rejected when tokens are configured.
- Never ship private keys inside MCP prompts or connector metadata.
